"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import Link from "next/link";

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

export default async function ResumesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const resumes = await Resume.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .select("-content -jobDescription")
    .lean();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Resumes</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {resumes.length === 0
              ? "Create AI-tailored resumes for each job application."
              : `${resumes.length} resume${resumes.length !== 1 ? "s" : ""} created.`}
          </p>
        </div>
        <Link
          href="/resumes/new"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + New Resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center">
          <div className="max-w-sm mx-auto">
            <div className="text-4xl mb-4">📄</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">No resumes yet</h2>
            <p className="text-slate-500 text-sm mb-6">
              Generate a tailored resume in seconds using AI and your career history.
            </p>
            <Link
              href="/resumes/new"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Create your first resume
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resumes.map((resume) => (
            <Link
              key={resume._id.toString()}
              href={`/resumes/${resume._id}`}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors pr-2">
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
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
