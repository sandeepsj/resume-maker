import { useState } from "react";
import { addExperience, updateExperience, deleteExperience } from "@/lib/google-drive";
import type { ExperienceData, ExperienceTask } from "@/types/career";

function formatMonthYear(isoDate: string | null | undefined): string {
  if (!isoDate) return "Present";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toMonthInput(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  return isoDate.substring(0, 7);
}

/** Task shape while editing — skills held as comma-separated text for easy input. */
interface TaskFormState {
  id: string;
  title: string;
  details: string;
  skills: string;
  isDefault: boolean;
}

interface FormState {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  tasks: TaskFormState[];
}

const emptyForm: FormState = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
  tasks: [],
};

const emptyTask = (): TaskFormState => ({
  id: "",
  title: "",
  details: "",
  skills: "",
  isDefault: true,
});

function taskToForm(t: ExperienceTask): TaskFormState {
  return {
    id: t.id,
    title: t.title,
    details: t.details ?? "",
    skills: (t.skills ?? []).join(", "),
    isDefault: t.isDefault ?? false,
  };
}

function experienceToForm(exp: ExperienceData): FormState {
  return {
    company: exp.company,
    title: exp.title,
    location: exp.location ?? "",
    startDate: toMonthInput(exp.startDate),
    endDate: toMonthInput(exp.endDate),
    isCurrent: exp.isCurrent,
    description: exp.description,
    tasks: exp.tasks.map(taskToForm),
  };
}

/** A real id is a non-empty value not produced by the legacy migration. */
function ensureTaskId(id: string): string {
  return id && !id.startsWith("legacy-") ? id : crypto.randomUUID();
}

function formToData(form: FormState) {
  const tasks: ExperienceTask[] = form.tasks
    .filter((t) => t.title.trim())
    .map((t) => ({
      id: ensureTaskId(t.id),
      title: t.title.trim(),
      details: t.details.trim() || undefined,
      skills: t.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      isDefault: t.isDefault,
    }))
    .map((t) => ({ ...t, skills: t.skills.length ? t.skills : undefined }));

  return {
    company: form.company,
    title: form.title,
    location: form.location || undefined,
    startDate: form.startDate ? `${form.startDate}-01` : "",
    endDate: form.endDate && !form.isCurrent ? `${form.endDate}-01` : undefined,
    isCurrent: form.isCurrent,
    description: form.description,
    tasks,
    // Tasks are now the source of truth (Phase 2). Clear the legacy mirror on edit.
    highlights: [],
  };
}

interface ExperienceFormProps {
  initial: FormState;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function ExperienceForm({ initial, onSave, onCancel, saving }: ExperienceFormProps) {
  const [form, setForm] = useState<FormState>(initial);

  const set = (field: keyof FormState, value: string | boolean | TaskFormState[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateTask = (index: number, patch: Partial<TaskFormState>) =>
    set("tasks", form.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  const addTask = () => set("tasks", [...form.tasks, emptyTask()]);

  const removeTask = (index: number) =>
    set("tasks", form.tasks.filter((_, i) => i !== index));

  const moveTask = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= form.tasks.length) return;
    const next = [...form.tasks];
    [next[index], next[target]] = [next[target], next[index]];
    set("tasks", next);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Company <span className="text-red-500">*</span>
          </label>
          <input type="text" value={form.company} onChange={(e) => set("company", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Acme Corp" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Job Title <span className="text-red-500">*</span>
          </label>
          <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Software Engineer" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
        <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="San Francisco, CA" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input type="month" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
          <input type="month" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
            disabled={form.isCurrent}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400" />
          <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isCurrent}
              onChange={(e) => { set("isCurrent", e.target.checked); if (e.target.checked) set("endDate", ""); }}
              className="rounded" />
            I currently work here
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Role Summary <span className="text-red-500">*</span>
        </label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="A short summary of your overall role and responsibilities..." />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tasks</label>
            <p className="text-xs text-slate-400">Break the role into the specific things you worked on. Mark which to include by default when building a resume.</p>
          </div>
          <button type="button" onClick={addTask} className="text-xs text-blue-500 hover:text-blue-700 font-medium shrink-0">
            + Add task
          </button>
        </div>
        <div className="space-y-3">
          {form.tasks.length === 0 && (
            <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">
              No tasks yet. Add the key things you did in this role.
            </p>
          )}
          {form.tasks.map((t, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1 text-slate-400">
                  <button type="button" onClick={() => moveTask(i, -1)} disabled={i === 0}
                    title="Move up" className="hover:text-slate-700 disabled:opacity-30 text-xs leading-none">▲</button>
                  <button type="button" onClick={() => moveTask(i, 1)} disabled={i === form.tasks.length - 1}
                    title="Move down" className="hover:text-slate-700 disabled:opacity-30 text-xs leading-none">▼</button>
                </div>
                <input type="text" value={t.title} onChange={(e) => updateTask(i, { title: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Task ${i + 1} — e.g. "Built real-time ingestion pipeline"`} />
                <button type="button" onClick={() => removeTask(i)}
                  className="px-2 py-2 text-red-500 hover:text-red-700 text-sm shrink-0">✕</button>
              </div>
              <textarea value={t.details} onChange={(e) => updateTask(i, { details: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional detail / impact (numbers help)" />
              <div className="flex items-center gap-3 flex-wrap">
                <input type="text" value={t.skills} onChange={(e) => updateTask(i, { skills: e.target.value })}
                  className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Skills/tech used (comma separated)" />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                  <input type="checkbox" checked={t.isDefault} onChange={(e) => updateTask(i, { isDefault: e.target.checked })} className="rounded" />
                  Include by default
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => onSave(form)}
          disabled={saving || !form.company || !form.title || !form.startDate || !form.description}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ExperienceManagerProps {
  initialExperiences: ExperienceData[];
}

export function ExperienceManager({ initialExperiences }: ExperienceManagerProps) {
  const [experiences, setExperiences] = useState<ExperienceData[]>(initialExperiences);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (form: FormState) => {
    setSaving(true);
    setError(null);
    try {
      const created = await addExperience(formToData(form) as Omit<ExperienceData, "id">);
      setExperiences((prev) => [created, ...prev]);
      setShowForm(false);
    } catch {
      setError("Failed to save experience. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string, form: FormState) => {
    setSaving(true);
    setError(null);
    try {
      const data = formToData(form);
      await updateExperience(id, data);
      setExperiences((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data } : e))
      );
      setEditingId(null);
    } catch {
      setError("Failed to update experience. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this experience? This cannot be undone.")) return;
    try {
      await deleteExperience(id);
      setExperiences((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Failed to delete. Please try again.");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Work Experience</h1>
          <p className="text-slate-500 mt-1 text-sm">Add your work history to power AI resume generation.</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); }}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            + Add Experience
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <div className="mb-6">
          <ExperienceForm initial={emptyForm} onSave={handleAdd} onCancel={() => setShowForm(false)} saving={saving} />
        </div>
      )}

      {experiences.length === 0 && !showForm ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">No work experience added yet.</p>
          <p className="text-slate-400 text-sm mb-6">Add your experience to help AI tailor your resumes.</p>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-3 font-medium transition-colors">
            Add your first experience
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences.map((exp) =>
            editingId === exp.id ? (
              <ExperienceForm key={exp.id} initial={experienceToForm(exp)}
                onSave={(form) => handleEdit(exp.id, form)} onCancel={() => setEditingId(null)} saving={saving} />
            ) : (
              <div key={exp.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{exp.title}</h3>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700">{exp.company}</span>
                      {exp.location && (<><span className="text-slate-400">·</span><span className="text-slate-500 text-sm">{exp.location}</span></>)}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {formatMonthYear(exp.startDate)} — {exp.isCurrent ? "Present" : formatMonthYear(exp.endDate)}
                    </p>
                    <p className="text-sm text-slate-600 mt-2">{exp.description}</p>
                    {exp.tasks.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {exp.tasks.map((t) => (
                          <li key={t.id} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-slate-400 mt-0.5">•</span>
                            <span>
                              <span className="text-slate-700">{t.title}</span>
                              {t.isDefault && <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 align-middle">default</span>}
                              {t.details && <span className="block text-slate-500 text-xs mt-0.5">{t.details}</span>}
                              {t.skills && t.skills.length > 0 && (
                                <span className="flex flex-wrap gap-1 mt-1">
                                  {t.skills.map((s, si) => (
                                    <span key={si} className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{s}</span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button onClick={() => { setEditingId(exp.id); setShowForm(false); }}
                      className="text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                    <button onClick={() => handleDelete(exp.id)}
                      className="text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 transition-colors">Delete</button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
