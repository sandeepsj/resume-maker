import { useState, useEffect, useRef } from "react";
import { Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  getExperiences,
  getEducation,
  getSkills,
  getProfile,
  createResume,
  updateResume,
  saveDefaultTaskSelection,
} from "@/lib/google-drive";
import {
  generateResume,
  AVAILABLE_MODELS,
  RESUME_DEFAULT_MODEL,
} from "@/lib/ai-client";
import {
  GENERATE_RESUME_SYSTEM_PROMPT,
  buildGenerateResumePrompt,
} from "@/prompts/generate-resume";
import type { ExperienceData } from "@/types/career";

type Step = 1 | 2 | 3;

interface JobDetails {
  title: string;
  company: string;
  jobDescription: string;
}

/** Task ids selected by default for an experience: those marked isDefault, else all. */
function defaultTaskIds(exp: ExperienceData): string[] {
  const defaults = exp.tasks.filter((t) => t.isDefault).map((t) => t.id);
  return defaults.length ? defaults : exp.tasks.map((t) => t.id);
}

export function NewResumePage() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [step, setStep] = useState<Step>(1);

  const [jobDetails, setJobDetails] = useState<JobDetails>({
    title: "", company: "", jobDescription: "",
  });

  const [experiences, setExperiences] = useState<ExperienceData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Per-experience selected task ids: { [experienceId]: Set<taskId> }
  const [selectedTasks, setSelectedTasks] = useState<Record<string, Set<string>>>({});
  const [loadingExperiences, setLoadingExperiences] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(RESUME_DEFAULT_MODEL);

  // Undo history: snapshots of the form state before each change
  type Snapshot = {
    step: Step;
    jobDetails: JobDetails;
    selectedIds: Set<string>;
    selectedTasks: Record<string, Set<string>>;
  };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const prevSnapshot = useRef<Snapshot>({ step, jobDetails, selectedIds, selectedTasks });
  const isUndoing = useRef(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (isUndoing.current) {
      isUndoing.current = false;
      prevSnapshot.current = { step, jobDetails, selectedIds, selectedTasks };
      return;
    }
    setHistory((prev) => [...prev, prevSnapshot.current]);
    prevSnapshot.current = { step, jobDetails, selectedIds, selectedTasks };
  }, [step, jobDetails, selectedIds, selectedTasks]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    isUndoing.current = true;
    setStep(last.step);
    setJobDetails(last.jobDetails);
    setSelectedIds(last.selectedIds);
    setSelectedTasks(last.selectedTasks);
    setHistory((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    if (step === 2 && experiences.length === 0) {
      setLoadingExperiences(true);
      getExperiences()
        .then((data) => {
          setExperiences(data);
          setSelectedIds(new Set(data.map((e) => e.id)));
          const init: Record<string, Set<string>> = {};
          for (const e of data) init[e.id] = new Set(defaultTaskIds(e));
          setSelectedTasks(init);
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(experiences.map((e) => e.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const toggleTask = (expId: string, taskId: string) => {
    setSelectedTasks((prev) => {
      const set = new Set(prev[expId] ?? []);
      if (set.has(taskId)) set.delete(taskId); else set.add(taskId);
      return { ...prev, [expId]: set };
    });
  };

  const setAllTasks = (exp: ExperienceData, on: boolean) => {
    setSelectedTasks((prev) => ({
      ...prev,
      [exp.id]: new Set(on ? exp.tasks.map((t) => t.id) : []),
    }));
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    setError(null);
    try {
      const selection: Record<string, string[]> = {};
      for (const id of selectedIds) selection[id] = Array.from(selectedTasks[id] ?? []);
      const updated = await saveDefaultTaskSelection(selection);
      setExperiences(updated);
      setDefaultsSaved(true);
      setTimeout(() => setDefaultsSaved(false), 2500);
    } catch {
      setError("Failed to save default selection. Please try again.");
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setStreamText("");

    try {
      // Create resume shell in Drive
      const resume = await createResume({
        title: `${jobDetails.title} at ${jobDetails.company}`,
        jobTitle: jobDetails.title,
        companyName: jobDetails.company,
        jobDescription: jobDetails.jobDescription,
      });
      await updateResume(resume.id, { status: "GENERATING" });

      // Fetch all career data for AI context
      const [allExperiences, education, skills, profile] = await Promise.all([
        getExperiences(),
        getEducation(),
        getSkills(),
        getProfile(),
      ]);

      // Only the selected experiences, each narrowed to its selected tasks.
      const selectedExperiences = allExperiences
        .filter((e) => selectedIds.has(e.id))
        .map((e) => {
          const taskSet = selectedTasks[e.id];
          return taskSet ? { ...e, tasks: e.tasks.filter((t) => taskSet.has(t.id)) } : e;
        });

      const userPrompt = buildGenerateResumePrompt({
        profile,
        userEmail: user?.email || "",
        userName: user?.name || "",
        experiences: selectedExperiences,
        educations: education,
        skills,
        jobTitle: jobDetails.title,
        companyName: jobDetails.company,
        jobDescription: jobDetails.jobDescription,
      });

      const content = await generateResume({
        systemPrompt: GENERATE_RESUME_SYSTEM_PROMPT,
        userPrompt,
        accessToken: accessToken!,
        model,
        onChunk: (text) => setStreamText((prev) => prev + text),
      });

      await updateResume(resume.id, {
        content,
        status: "READY",
        aiModel: model,
      });

      navigate(`/resumes/${resume.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setGenerating(false);
    }
  };

  const canProceedStep1 =
    jobDetails.title.trim() && jobDetails.company.trim() && jobDetails.jobDescription.trim();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Create New Resume</h1>
          <button
            onClick={handleUndo}
            disabled={history.length === 0 || generating}
            title="Undo last change"
            className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? "bg-blue-500 text-white" : step > s ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>
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

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Job Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Title <span className="text-red-500">*</span></label>
              <input type="text" value={jobDetails.title} onChange={(e) => setJobDetails((p) => ({ ...p, title: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senior Software Engineer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company <span className="text-red-500">*</span></label>
              <input type="text" value={jobDetails.company} onChange={(e) => setJobDetails((p) => ({ ...p, company: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Acme Corp" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job Description <span className="text-red-500">*</span></label>
            <textarea value={jobDetails.jobDescription} onChange={(e) => setJobDetails((p) => ({ ...p, jobDescription: e.target.value }))}
              rows={12} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Paste the full job description here..." />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!canProceedStep1}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
              Next: Select Experience
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Select Relevant Experience</h2>
            <div className="flex gap-3">
              <button onClick={selectAll} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Select All</button>
              <span className="text-slate-300">|</span>
              <button onClick={deselectAll} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Deselect All</button>
            </div>
          </div>
          {loadingExperiences ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-slate-100 rounded-lg" />)}</div>
          ) : experiences.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="mb-2">No work experience found.</p>
              <a href="#/career/experience" className="text-blue-500 text-sm hover:underline">Add experience first</a>
            </div>
          ) : (
            <div className="space-y-3">
              {experiences.map((exp) => {
                const isSelected = selectedIds.has(exp.id);
                const taskSet = selectedTasks[exp.id] ?? new Set<string>();
                return (
                  <div key={exp.id} className={`border rounded-xl transition-colors ${
                    isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <label className="flex items-start gap-3 p-4 cursor-pointer">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(exp.id)} className="mt-0.5 w-4 h-4 rounded text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm">{exp.title} · {exp.company}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatDate(exp.startDate)} — {exp.isCurrent ? "Present" : formatDate(exp.endDate)}</div>
                      </div>
                    </label>
                    {isSelected && exp.tasks.length > 0 && (
                      <div className="px-4 pb-4 pl-11">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-slate-500">Tasks to include ({taskSet.size}/{exp.tasks.length})</span>
                          <div className="flex gap-2 text-xs">
                            <button type="button" onClick={() => setAllTasks(exp, true)} className="text-blue-500 hover:text-blue-700">All</button>
                            <span className="text-slate-300">|</span>
                            <button type="button" onClick={() => setAllTasks(exp, false)} className="text-slate-500 hover:text-slate-700">None</button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {exp.tasks.map((t) => (
                            <label key={t.id} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={taskSet.has(t.id)} onChange={() => toggleTask(exp.id, t.id)} className="mt-0.5 w-3.5 h-3.5 rounded text-blue-500" />
                              <span>
                                {t.title}
                                {t.skills && t.skills.length > 0 && (
                                  <span className="text-xs text-slate-400"> · {t.skills.join(", ")}</span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {isSelected && exp.tasks.length === 0 && (
                      <p className="px-4 pb-4 pl-11 text-xs text-slate-400">No tasks on this experience — add some on the Experience page for finer control.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {experiences.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={handleSaveDefaults} disabled={savingDefaults}
                className="text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 font-medium disabled:opacity-50 transition-colors">
                {savingDefaults ? "Saving…" : "Save current selection as default"}
              </button>
              {defaultsSaved && <span className="text-xs text-green-600">✓ Saved to your career profile</span>}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors">Back</button>
            <button onClick={() => setStep(3)} disabled={selectedIds.size === 0}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors">Next: Generate</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Generate Resume</h2>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex gap-6 text-sm">
              <div><span className="text-slate-500">Role: </span><span className="font-medium text-slate-900">{jobDetails.title}</span></div>
              <div><span className="text-slate-500">Company: </span><span className="font-medium text-slate-900">{jobDetails.company}</span></div>
            </div>
            <div className="text-sm"><span className="text-slate-500">Experiences: </span><span className="font-medium text-slate-900">{selectedIds.size} selected</span></div>
            <div className="text-xs text-slate-400 mt-2">{jobDetails.jobDescription.substring(0, 200)}{jobDetails.jobDescription.length > 200 ? "..." : ""}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">AI Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={generating}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white">
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {streamText && (
            <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Generating...</p>
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
            <button onClick={() => setStep(2)} disabled={generating}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">Back</button>
            <button onClick={handleGenerate} disabled={generating}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2">
              {generating ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</>) : "Generate Resume"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
