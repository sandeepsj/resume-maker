import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteResume } from "@/lib/google-drive";
import type { ResumeListItem } from "@/lib/google-drive";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    READY: "bg-green-100 text-green-700",
    GENERATING: "bg-blue-100 text-blue-700",
    DRAFT: "bg-slate-100 text-slate-600",
    EXPORTED: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export function ResumesClient({ initialResumes }: { initialResumes: ResumeListItem[] }) {
  const [resumes, setResumes] = useState(initialResumes);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this resume? This cannot be undone.")) return;

    setDeletingId(id);
    try {
      await deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete resume. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (resumes.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center">
        <div className="max-w-sm mx-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No resumes yet</h2>
          <p className="text-slate-500 text-sm mb-6">
            Generate a tailored resume in seconds using AI and your career history.
          </p>
          <Link
            to="/resumes/new"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-3 font-medium transition-colors"
          >
            Create your first resume
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {resumes.map((resume) => (
        <div key={resume.id} className="relative group">
          <Link
            to={`/resumes/${resume.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors pr-2 leading-snug">
                {resume.title}
              </h3>
              <StatusBadge status={resume.status} />
            </div>
            {(resume.jobTitle || resume.companyName) && (
              <p className="text-sm text-slate-500 mb-3">
                {[resume.jobTitle, resume.companyName].filter(Boolean).join(" at ")}
              </p>
            )}
            <p className="text-xs text-slate-400">
              {new Date(resume.createdAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </Link>
          <button
            onClick={(e) => handleDelete(e, resume.id)}
            disabled={deletingId === resume.id}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white text-xs rounded-md px-2 py-1 transition-all disabled:opacity-50"
            title="Delete resume"
          >
            {deletingId === resume.id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ))}
    </div>
  );
}
