import { useState } from "react";
import { streamAI } from "@/lib/ai-client";
import type { ResumeContent } from "@/types/resume";

interface ATSScoreProps {
  content: ResumeContent;
  jobDescription: string;
  accessToken: string;
  onClose: () => void;
}

interface ScoreBreakdown {
  score: number;
  found?: string[];
  missing?: string[];
  feedback?: string;
}

interface ATSResult {
  score: number;
  breakdown: {
    keywordMatch: ScoreBreakdown;
    experienceRelevance: ScoreBreakdown;
    skillsAlignment: ScoreBreakdown;
    formatting: ScoreBreakdown;
  };
  suggestions: string[];
}

const SYSTEM_PROMPT = `You are an ATS (Applicant Tracking System) scoring expert. You analyze resumes against job descriptions and provide detailed compatibility scores.

Analyze the resume against the job description and return a JSON score report.

Scoring criteria:
- **Keyword Match (0-100)**: How many key terms, technologies, and phrases from the job description appear in the resume? List found and missing keywords.
- **Experience Relevance (0-100)**: How well does the candidate's experience align with the role requirements? Consider years, domain, and responsibilities.
- **Skills Alignment (0-100)**: How well do the listed skills match what the job requires? Consider both hard and soft skills.
- **Formatting (0-100)**: Is the resume well-structured for ATS parsing? Clear sections, no tables/graphics issues, proper hierarchy.

The overall score is a weighted average: Keyword Match (35%) + Experience Relevance (30%) + Skills Alignment (25%) + Formatting (10%).

Return ONLY valid JSON, no markdown fences.`;

function buildPrompt(content: ResumeContent, jobDescription: string): string {
  return `RESUME CONTENT:
${JSON.stringify(content, null, 2)}

JOB DESCRIPTION:
${jobDescription}

Return a JSON object with EXACTLY this structure:
{
  "score": <number 0-100>,
  "breakdown": {
    "keywordMatch": { "score": <0-100>, "found": ["keyword1", ...], "missing": ["keyword1", ...] },
    "experienceRelevance": { "score": <0-100>, "feedback": "1-2 sentence assessment" },
    "skillsAlignment": { "score": <0-100>, "feedback": "1-2 sentence assessment" },
    "formatting": { "score": <0-100>, "feedback": "1-2 sentence assessment" }
  },
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", ...]
}

Analyze now:`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-700 bg-green-100";
  if (score >= 60) return "text-yellow-700 bg-yellow-100";
  return "text-red-700 bg-red-100";
}

function barColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

export function ATSScore({ content, jobDescription, accessToken, onClose }: ATSScoreProps) {
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<ATSResult | null>(null);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    setLoading(true);
    setStreamText("");
    setError("");
    setResult(null);

    try {
      const fullText = await streamAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildPrompt(content, jobDescription),
        accessToken,
        maxTokens: 4096,
        temperature: 0.2,
        onChunk: (text) => setStreamText((prev) => prev + text),
      });

      const cleaned = fullText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned) as ATSResult;
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-slate-900">ATS Score Check</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!result && !loading && !error && (
            <div className="text-center py-6">
              <p className="text-sm text-slate-600 mb-4">
                Analyze how well your resume matches the job description for ATS compatibility.
              </p>
              <button onClick={handleCheck}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors">
                Run ATS Analysis
              </button>
            </div>
          )}

          {loading && (
            <div className="py-4">
              <div className="flex items-center gap-3 text-slate-500 text-sm mb-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Analyzing resume against job description...
              </div>
              {streamText && (
                <div className="p-3 bg-slate-50 rounded-lg max-h-32 overflow-y-auto">
                  <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono">{streamText}</pre>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="py-4">
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-3">{error}</p>
              <button onClick={handleCheck}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">Try again</button>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              {/* Overall score */}
              <div className="text-center py-3">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-2xl font-bold ${scoreColor(result.score)}`}>
                  {result.score}
                </div>
                <p className="text-sm text-slate-500 mt-2">Overall ATS Score</p>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <ScoreBar label="Keyword Match" score={result.breakdown.keywordMatch.score} />
                <ScoreBar label="Experience Relevance" score={result.breakdown.experienceRelevance.score} />
                <ScoreBar label="Skills Alignment" score={result.breakdown.skillsAlignment.score} />
                <ScoreBar label="Formatting" score={result.breakdown.formatting.score} />
              </div>

              {/* Keywords */}
              {result.breakdown.keywordMatch.missing && result.breakdown.keywordMatch.missing.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Missing Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.breakdown.keywordMatch.missing.map((kw, i) => (
                      <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.breakdown.keywordMatch.found && result.breakdown.keywordMatch.found.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Matched Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.breakdown.keywordMatch.found.map((kw, i) => (
                      <span key={i} className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {[
                { label: "Experience", fb: result.breakdown.experienceRelevance.feedback },
                { label: "Skills", fb: result.breakdown.skillsAlignment.feedback },
                { label: "Formatting", fb: result.breakdown.formatting.feedback },
              ].filter((f) => f.fb).map((f, i) => (
                <div key={i}>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</h4>
                  <p className="text-sm text-slate-600">{f.fb}</p>
                </div>
              ))}

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Suggestions</h4>
                  <ul className="space-y-1.5">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-700">
                        <span className="text-blue-500 shrink-0 mt-0.5">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Re-run */}
              <div className="pt-2">
                <button onClick={handleCheck}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium">Re-analyze</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-sm font-medium text-slate-900">{score}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
