import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import Link from "next/link";
import ResumesClient from "./ResumesClient";

export default async function ResumesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const raw = await Resume.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .select("-content -jobDescription")
    .lean();

  const resumes = raw.map((r) => ({
    id: r._id.toString(),
    title: r.title,
    jobTitle: r.jobTitle ?? null,
    companyName: r.companyName ?? null,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

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

      <ResumesClient initialResumes={resumes} />
    </div>
  );
}
