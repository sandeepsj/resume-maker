import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listResumes } from "@/lib/google-drive";
import { ResumesClient } from "@/components/ResumesClient";
import type { ResumeListItem } from "@/lib/google-drive";

export function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeListItem[] | null>(null);

  useEffect(() => {
    listResumes().then(setResumes).catch(console.error);
  }, []);

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
        <Link
          to="/resumes/new"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + New Resume
        </Link>
      </div>
      <ResumesClient initialResumes={resumes} />
    </div>
  );
}
