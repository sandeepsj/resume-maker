"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ExperienceData } from "@/types/career";

type Step = 1 | 2 | 3;

interface JobDetails {
  title: string;
  company: string;
  jobDescription: string;
}

export default function NewResumePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [jobDetails, setJobDetails] = useState<JobDetails>({
    title: "",
    company: "",
    jobDescription: "",
  });

  // Step 2
  const [experiences, setExperiences] = useState<ExperienceData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingExperiences, setLoadingExperiences] = useState(false);

  // Step 3
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 2 && experiences.length === 0) {
      setLoadingExperiences(true);
      fetch("/api/career/experience")
        .then((r) => r.json())
        .then((data: Array<{ _id: string; company: string; title: string; location?: string; startDate: string; endDate?: string; isCurrent: boolean; description: string; highlights: string[] }>) => {
          const mapped: ExperienceData[] = data.map((e) => ({
            id: e._id,
            company: e.company,
            title: e.title,
            location: e.location ?? null,
            startDate: e.startDate,
            endDate: e.endDate ?? null,
            isCurrent: e.isCurrent,
            description: e.description,
            highlights: e.highlights,
          }));
          setExperiences(mapped);
          setSelectedIds(new Set(mapped.map((e) => e.id)));
        })
        .catch(() => {})
        .finally(() => setLoadingExperiences(false));
    }
  }, [step, experiences.length]);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "Present";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(experiences.map((e) => e.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setStreamText("");

    try {
      // Create the resume shell
      const createRes = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${jobDetails.title} at ${jobDetails.company}`,
          jobTitle: jobDetails.title,
          companyName: jobDetails.company,
          jobDescription: jobDetails.jobDescription,
        }),
      });

      if (!createRes.ok) throw new Error("Failed to create resume");
      const created = await createRes.json();
      const resumeId: string = created._id;

      // Stream generation
      const genRes = await fetch("/api/ai/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId,
          jobTitle: jobDetails.title,
          companyName: jobDetails.company,
          jobDescription: jobDetails.jobDescription,
          selectedExperienceIds: Array.from(selectedIds),
        }),
      });

      if (!genRes.ok) throw new Error("Failed to start generation");

      const reader = genRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const rawJson = line.replace("data: ", "").trim();
          if (!rawJson) continue;

          try {
            const json = JSON.parse(rawJson);
            if (json.type === "chunk") {
              setStreamText((prev) => prev + json.text);
            } else if (json.type === "done") {
              router.push(`/resumes/${json.resumeId ?? resumeId}`);
              return;
            } else if (json.type === "error") {
              setError(json.error ?? "Generation failed");
              setGenerating(false);
              return;
            }
          } catch {
            // Partial JSON line, skip
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setGenerating(false);
    }
  };

  const canProceedStep1 =
    jobDetails.title.trim() && jobDetails.company.trim() && jobDetails.jobDescription.trim();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create New Resume</h1>
        <div className="flex items-center gap-2 mt-3">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-blue-500 text-white"
                    : step > s
                      ? "bg-green-500 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {step > s ? "✓" : s}
              </div>
              <span className={`text-sm ${step === s ? "text-slate-900 font-medium" : "text-slate-400"}`}>
                {s === 1 ? "Job Details" : s === 2 ? "Select Experience" : "Generate"}
              </span>
              {s < 3 && <div className="w-8 h-px bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Job Details */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Job Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={jobDetails.title}
                onChange={(e) => setJobDetails((p) => ({ ...p, title: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Senior Software Engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={jobDetails.company}
                onChange={(e) => setJobDetails((p) => ({ ...p, company: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corp"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={jobDetails.jobDescription}
              onChange={(e) => setJobDetails((p) => ({ ...p, jobDescription: e.target.value }))}
              rows={12}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Paste the full job description here. The more detail, the better the AI can tailor your resume..."
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              Next: Select Experience
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Experience */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Select Relevant Experience</h2>
            <div className="flex gap-3">
              <button
                onClick={selectAll}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={deselectAll}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                Deselect All
              </button>
            </div>
          </div>

          {loadingExperiences ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : experiences.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="mb-2">No work experience found.</p>
              <a href="/career/experience" className="text-blue-500 text-sm hover:underline">
                Add experience first
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {experiences.map((exp) => (
                <label
                  key={exp.id}
                  className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                    selectedIds.has(exp.id)
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(exp.id)}
                    onChange={() => toggleSelect(exp.id)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">
                      {exp.title} · {exp.company}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(exp.startDate)} — {exp.isCurrent ? "Present" : formatDate(exp.endDate)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedIds.size === 0}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              Next: Generate
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generate */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Generate Resume</h2>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-slate-500">Role: </span>
                <span className="font-medium text-slate-900">{jobDetails.title}</span>
              </div>
              <div>
                <span className="text-slate-500">Company: </span>
                <span className="font-medium text-slate-900">{jobDetails.company}</span>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-slate-500">Experiences: </span>
              <span className="font-medium text-slate-900">{selectedIds.size} selected</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {jobDetails.jobDescription.substring(0, 200)}
              {jobDetails.jobDescription.length > 200 ? "..." : ""}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {streamText && (
            <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">
                Generating...
              </p>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{streamText}</pre>
            </div>
          )}

          {generating && !streamText && (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>AI is analyzing the job description and tailoring your resume...</span>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={generating}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Resume"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
