"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Comment } from "@/lib/models/Comment";
import Link from "next/link";
import ResumeViewer from "./ResumeViewer";
import type { ResumeContent } from "@/types/resume";

interface CommentData {
  id: string;
  sectionKey: string;
  selectedText: string;
  anchorOffset: number;
  focusOffset: number;
  body: string;
  status: string;
  aiResponse?: string | null;
  createdAt: string;
}

export default async function ResumePage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { resumeId } = await params;
  await connectDB();

  const resume = await Resume.findOne({ _id: resumeId, userId: session.user.id }).lean();
  if (!resume) redirect("/resumes");

  if (resume.status === "GENERATING") {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link
          href="/resumes"
          className="text-sm text-slate-500 hover:text-slate-900 mb-6 inline-flex items-center gap-1"
        >
          ← Back to Resumes
        </Link>
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center mt-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Generating Your Resume</h2>
          <p className="text-slate-500 text-sm">
            AI is crafting a tailored resume for <strong>{resume.jobTitle}</strong> at{" "}
            <strong>{resume.companyName}</strong>. This may take a moment.
          </p>
          <p className="text-slate-400 text-xs mt-4">Refresh the page to check progress.</p>
        </div>
      </div>
    );
  }

  if (resume.status === "DRAFT" || !resume.content) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link
          href="/resumes"
          className="text-sm text-slate-500 hover:text-slate-900 mb-6 inline-flex items-center gap-1"
        >
          ← Back to Resumes
        </Link>
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center mt-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Resume Not Ready</h2>
          <p className="text-slate-500 text-sm">This resume has not been generated yet.</p>
        </div>
      </div>
    );
  }

  const rawComments = await Comment.find({ resumeId: resume._id }).sort({ createdAt: -1 }).lean();

  const comments: CommentData[] = rawComments.map((c) => ({
    id: c._id.toString(),
    sectionKey: c.sectionKey,
    selectedText: c.selectedText,
    anchorOffset: c.anchorOffset,
    focusOffset: c.focusOffset,
    body: c.body,
    status: c.status,
    aiResponse: c.aiResponse ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <ResumeViewer
      resumeId={resumeId}
      content={resume.content as ResumeContent}
      resumeTitle={resume.title}
      initialComments={comments}
    />
  );
}
