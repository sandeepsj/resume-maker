/**
 * Phase 3 orchestration: given a job description, rank the existing resume
 * collection by keyword fit. AI extracts keywords (JD once; each resume once,
 * cached in its `resume.json` keyed by a content hash). Ranking is deterministic.
 *
 * Reusable by both the UI and the MCP connector (Phase 4).
 */
import { listResumes, getResume, updateResume } from "@/lib/google-drive";
import type { ResumeContent } from "@/types/resume";
import {
  extractKeywords,
  rankResumes,
  hashText,
  type WeightedKeyword,
  type ResumeMatchScore,
} from "@/lib/keyword-extractor";

export interface ResumeMatchResult {
  id: string;
  title: string;
  jobTitle?: string;
  companyName?: string;
  status: string;
  match: ResumeMatchScore;
}

/** Flatten resume content into a single text blob for keyword extraction. */
export function resumeContentToText(content: ResumeContent): string {
  const parts: string[] = [];
  if (content.header?.headline) parts.push(content.header.headline);
  if (content.summary) parts.push(content.summary);
  for (const exp of content.experience ?? []) {
    parts.push(`${exp.title} at ${exp.company}`);
    for (const b of exp.bullets ?? []) parts.push(b);
  }
  for (const group of content.skills ?? []) {
    parts.push(`${group.category}: ${group.skills.join(", ")}`);
  }
  for (const proj of content.projects ?? []) {
    parts.push(`${proj.name}: ${proj.description} (${proj.technologies.join(", ")})`);
  }
  for (const cert of content.certifications ?? []) {
    parts.push(`${cert.name} — ${cert.issuer}`);
  }
  // Strip **bold** markers so they don't pollute keywords.
  return parts.join("\n").replace(/\*\*/g, "");
}

/**
 * Return a resume's weighted keywords, extracting + caching them if missing or
 * stale (content changed since last extraction). Returns null if the resume has
 * no content yet.
 */
export async function ensureResumeKeywords(
  resumeId: string,
  accessToken: string
): Promise<WeightedKeyword[] | null> {
  const resume = await getResume(resumeId);
  if (!resume?.content) return null;

  const text = resumeContentToText(resume.content);
  const hash = hashText(text);
  if (resume.keywords && resume.keywordsHash === hash) return resume.keywords;

  const keywords = await extractKeywords(text, accessToken);
  await updateResume(resumeId, { keywords, keywordsHash: hash });
  return keywords;
}

/**
 * Rank the existing resume collection against a job description.
 * One AI call for the JD; one per resume only when its keywords are missing/stale.
 * `onProgress` reports the title currently being processed (for UI feedback).
 */
export async function findBestResume(
  jobDescription: string,
  accessToken: string,
  onProgress?: (step: string, done: number, total: number) => void
): Promise<ResumeMatchResult[]> {
  onProgress?.("Analyzing job description…", 0, 0);
  const jd = await extractKeywords(jobDescription, accessToken);

  const list = await listResumes();
  const ready = list.filter((r) => r.status === "READY" || r.status === "EXPORTED");

  const withKeywords: { id: string; item: (typeof ready)[number]; keywords: WeightedKeyword[] }[] = [];
  for (let i = 0; i < ready.length; i++) {
    const item = ready[i];
    onProgress?.(`Indexing "${item.title}"`, i, ready.length);
    try {
      const kw = await ensureResumeKeywords(item.id, accessToken);
      if (kw) withKeywords.push({ id: item.id, item, keywords: kw });
    } catch {
      // Skip resumes that fail to extract; keep ranking the rest.
    }
  }

  const ranked = rankResumes(jd, withKeywords.map((r) => ({ id: r.id, keywords: r.keywords })));
  const byId = new Map(withKeywords.map((r) => [r.id, r.item]));

  return ranked.map((r) => {
    const item = byId.get(r.id)!;
    return {
      id: item.id,
      title: item.title,
      jobTitle: item.jobTitle,
      companyName: item.companyName,
      status: item.status,
      match: r.match,
    };
  });
}
