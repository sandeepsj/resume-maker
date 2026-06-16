/**
 * Keyword extraction + deterministic resume↔JD matching (Phase 3).
 *
 * AI is used ONLY to turn a piece of text (a resume or a job description) into a
 * list of weighted keywords ordered by importance *in that text*. The actual
 * ranking is deterministic (a cosine similarity over the keyword vectors), so
 * searching the collection costs one AI call (the JD) plus cached math.
 *
 * This module is pure/headless (no Drive access) so the MCP connector (Phase 4)
 * can reuse it. Orchestration that touches Drive lives in `resume-matching.ts`.
 */
import { streamAI } from "@/lib/ai-client";

export interface WeightedKeyword {
  keyword: string; // normalized: lowercased, trimmed canonical form
  weight: number;  // 0..1 importance/prominence IN the source text
}

export interface MatchedKeyword {
  keyword: string;
  jdWeight: number;
  resumeWeight: number;
}

export interface ResumeMatchScore {
  score: number;             // 0..100 (cosine similarity × 100)
  matched: MatchedKeyword[]; // keywords present in both, strongest first
}

const SYSTEM_PROMPT = `You extract the key skills, technologies, tools, and domain terms from a piece of text (a resume or a job description) and rank them by how important/prominent they are IN THAT TEXT.

Rules:
- Return concrete, matchable keywords: languages, frameworks, libraries, tools, platforms, methodologies, and domain skills (e.g. "java", "kubernetes", "distributed systems", "payment processing"). Skip generic filler ("team player", "responsibilities", "fast learner").
- Assign each keyword a weight from 0 to 1 for its importance/prominence in THIS text. A skill the text emphasizes (a core requirement, mentioned early or often) gets a HIGH weight; a passing mention gets a LOW weight.
- Normalize each keyword to a lowercase canonical form (e.g. "JS" -> "javascript", "K8s" -> "kubernetes", "Postgres" -> "postgresql").
- Return at most 30 keywords, sorted by weight descending.
- Return ONLY valid JSON, no markdown fences.`;

function buildPrompt(text: string): string {
  return `TEXT:
${text}

Return a JSON object with EXACTLY this shape:
{ "keywords": [ { "keyword": "java", "weight": 0.95 }, { "keyword": "kubernetes", "weight": 0.8 } ] }

Extract now:`;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function normalizeKeyword(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** AI call: returns weighted keywords for `text`, sorted by importance descending. */
export async function extractKeywords(
  text: string,
  accessToken: string
): Promise<WeightedKeyword[]> {
  const fullText = await streamAI({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildPrompt(text),
    accessToken,
    maxTokens: 1500,
    temperature: 0.1,
  });

  const cleaned = fullText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as { keywords?: { keyword?: unknown; weight?: unknown }[] };

  // Dedupe by normalized keyword, keeping the max weight.
  const byKey = new Map<string, number>();
  for (const k of parsed.keywords ?? []) {
    if (typeof k.keyword !== "string" || typeof k.weight !== "number") continue;
    const key = normalizeKeyword(k.keyword);
    if (!key) continue;
    byKey.set(key, Math.max(byKey.get(key) ?? 0, clamp01(k.weight)));
  }

  return [...byKey.entries()]
    .map(([keyword, weight]) => ({ keyword, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Deterministic fit score: cosine similarity between the JD and resume keyword
 * vectors. Aligned priority wins — if the JD weights `java` high, a resume that
 * also weights `java` high contributes a large term and outranks a resume where
 * `java` is merely present at low priority. Cosine normalizes for resume length
 * so a focused resume isn't beaten by a longer, less-relevant one.
 */
export function scoreResume(
  jd: WeightedKeyword[],
  resume: WeightedKeyword[]
): ResumeMatchScore {
  const resumeMap = new Map(resume.map((k) => [k.keyword, k.weight]));

  let dot = 0;
  let jdNorm = 0;
  const matched: MatchedKeyword[] = [];
  for (const k of jd) {
    jdNorm += k.weight * k.weight;
    const rw = resumeMap.get(k.keyword) ?? 0;
    if (rw > 0) {
      dot += k.weight * rw;
      matched.push({ keyword: k.keyword, jdWeight: k.weight, resumeWeight: rw });
    }
  }

  let resNorm = 0;
  for (const k of resume) resNorm += k.weight * k.weight;

  const denom = Math.sqrt(jdNorm) * Math.sqrt(resNorm);
  const cosine = denom > 0 ? dot / denom : 0;
  matched.sort((a, b) => b.jdWeight * b.resumeWeight - a.jdWeight * a.resumeWeight);

  return { score: Math.round(clamp01(cosine) * 100), matched };
}

/** Rank resumes against a JD, highest score first. */
export function rankResumes(
  jd: WeightedKeyword[],
  resumes: { id: string; keywords: WeightedKeyword[] }[]
): { id: string; match: ResumeMatchScore }[] {
  return resumes
    .map((r) => ({ id: r.id, match: scoreResume(jd, r.keywords) }))
    .sort((a, b) => b.match.score - a.match.score);
}

/** Fast non-cryptographic string hash (djb2) for content-staleness checks. */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
