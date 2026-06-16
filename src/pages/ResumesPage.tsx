import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listResumes } from "@/lib/google-drive";
import { ResumesClient } from "@/components/ResumesClient";
import { FindBestMatch } from "@/components/FindBestMatch";
import type { ResumeListItem } from "@/lib/google-drive";

export function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);

  useEffect(() => {
    listResumes((fresh) => setResumes(fresh))
      .then(setResumes)
      .catch((err) => {
        console.error("Failed to load resumes:", err);
        setError(err.message || "Failed to load resumes");
        setResumes([]);
      });
  }, []);

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}. Try signing out and back in.
        </div>
      </div>
    );
  }

  if (!resumes) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-slate-200 rounded" />
            <div className="h-32 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Resumes</h1>
        <div className="flex items-center gap-3">
          {resumes.length > 0 && (
            <button
              onClick={() => setMatchOpen(true)}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Find Best Match
            </button>
          )}
          <Link
            to="/resumes/new"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            + New Resume
          </Link>
        </div>
      </div>
      <ResumesClient initialResumes={resumes} />
      {matchOpen && <FindBestMatch onClose={() => setMatchOpen(false)} />}
    </div>
  );
}
