import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { findBestResume, type ResumeMatchResult } from "@/lib/resume-matching";

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-700 bg-green-100";
  if (score >= 40) return "text-yellow-700 bg-yellow-100";
  return "text-red-700 bg-red-100";
}

export function FindBestMatch({ onClose }: { onClose: () => void }) {
  const { accessToken } = useAuth();
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<ResumeMatchResult[] | null>(null);
  const [error, setError] = useState("");

  const handleFind = async () => {
    if (!jd.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    setProgress("Analyzing job description…");
    try {
      const ranked = await findBestResume(jd, accessToken!, (step) => setProgress(step));
      setResults(ranked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find a match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900">Find Best-Fit Resume</h3>
            <p className="text-xs text-slate-500 mt-0.5">Paste a job description to rank your existing resumes by keyword fit.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={6} disabled={loading}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:opacity-50"
            placeholder="Paste the full job description here..." />

          <div className="flex items-center gap-3">
            <button onClick={handleFind} disabled={loading || !jd.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? "Matching…" : "Find best resume"}
            </button>
            {loading && (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                {progress}
              </span>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

          {results && results.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">No completed resumes to match against. Create one first.</p>
          )}

          {results && results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, i) => (
                <Link key={r.id} to={`/resumes/${r.id}`}
                  className="block border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[10px] uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">Best fit</span>}
                        <h4 className="font-medium text-slate-900 truncate">{r.title}</h4>
                      </div>
                      {(r.jobTitle || r.companyName) && (
                        <p className="text-xs text-slate-500 mt-0.5">{[r.jobTitle, r.companyName].filter(Boolean).join(" at ")}</p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold ${scoreColor(r.match.score)}`}>
                      {r.match.score}
                    </span>
                  </div>
                  {r.match.matched.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.match.matched.slice(0, 8).map((m) => (
                        <span key={m.keyword} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{m.keyword}</span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
