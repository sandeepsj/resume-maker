import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <span className="text-xl font-semibold tracking-tight">ResumeMaker</span>
        <Link
          href="/login"
          className="bg-white text-slate-900 px-5 py-2 rounded-lg font-medium text-sm hover:bg-slate-100 transition-colors"
        >
          Sign in
        </Link>
      </nav>

      <section className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6">
          Resumes that match
          <span className="text-blue-400"> every job</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Store your career history once. Paste a job description. Get a tailored, ATS-optimized
          resume in seconds — powered by Claude AI.
        </p>
        <Link
          href="/login"
          className="inline-block bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors"
        >
          Get started with Google
        </Link>
      </section>

      <section className="max-w-5xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: "Career history once",
            desc: "Add your experiences, education, and skills once. AI uses it for every resume.",
          },
          {
            title: "Tailored in seconds",
            desc: "Paste the job description. AI rewrites your bullets to match the role and pass ATS filters.",
          },
          {
            title: "Inline AI editing",
            desc: "Select any text in your resume, leave a comment, and AI applies the change surgically.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
