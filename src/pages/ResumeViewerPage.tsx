import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getResume } from "@/lib/google-drive";
import { ResumeViewer } from "@/components/ResumeViewer";
import type { DriveResumeFile } from "@/lib/google-drive";

export function ResumeViewerPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const [resume, setResume] = useState<DriveResumeFile | null | undefined>(undefined);

  useEffect(() => {
    if (!resumeId) return;
    getResume(resumeId)
      .then(setResume)
      .catch(() => setResume(null));
  }, [resumeId]);

  if (resume === undefined) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Resume not found</h2>
        <Link to="/resumes" className="text-blue-500 hover:underline text-sm">Back to resumes</Link>
      </div>
    );
  }

  if (resume.status === "GENERATING") {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">Generating your resume...</h2>
        <p className="text-slate-500 text-sm mt-1">This may take a moment.</p>
      </div>
    );
  }

  if (!resume.content) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Resume has no content yet</h2>
        <p className="text-slate-500 text-sm mb-4">This resume is a draft without generated content.</p>
        <Link to="/resumes" className="text-blue-500 hover:underline text-sm">Back to resumes</Link>
      </div>
    );
  }

  return (
    <ResumeViewer
      resumeId={resume.id}
      content={resume.content}
      resumeTitle={resume.title}
      initialComments={resume.comments}
      jobTitle={resume.jobTitle}
      companyName={resume.companyName}
      jobDescription={resume.jobDescription}
    />
  );
}
