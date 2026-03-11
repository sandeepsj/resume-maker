import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Resume } from "@/lib/models/Resume";
import { Experience } from "@/lib/models/Experience";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();

  const [resumes, experienceCount] = await Promise.all([
    Resume.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    Experience.countDocuments({ userId: session.user.id }),
  ]);

  const hasCareerData = experienceCount > 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-500 mt-1">
          {resumes.length === 0
            ? "Create your first tailored resume."
            : `${resumes.length} resume${resumes.length !== 1 ? "s" : ""} created.`}
        </p>
      </div>

      {!hasCareerData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <h2 className="font-semibold text-amber-900 mb-1">Set up your career profile first</h2>
          <p className="text-amber-700 text-sm mb-3">
            Add your work experience, education, and skills before generating resumes. AI uses your
            career history to tailor each resume.
          </p>
          <Link
            href="/career/experience"
            className="inline-block bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Add experience
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent resumes</h2>
        <Link href="/resumes/new" className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          New resume
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">No resumes yet.</p>
          <Link
            href="/resumes/new"
            className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Create your first resume
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {resumes.map((resume) => (
            <Link
              key={resume._id.toString()}
              href={`/resumes/${resume._id}`}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{resume.title}</h3>
                  {resume.companyName && (
                    <p className="text-sm text-slate-500 mt-0.5">
                      {resume.jobTitle} at {resume.companyName}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    resume.status === "READY"
                      ? "bg-green-100 text-green-700"
                      : resume.status === "GENERATING"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {resume.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
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

      {resumes.length > 0 && (
        <div className="mt-4 text-center">
          <Link href="/resumes" className="text-sm text-blue-500 hover:text-blue-700">
            View all resumes
          </Link>
        </div>
      )}
    </div>
  );
}
