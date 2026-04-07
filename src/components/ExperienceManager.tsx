import { useState } from "react";
import { addExperience, updateExperience, deleteExperience } from "@/lib/google-drive";
import type { ExperienceData } from "@/types/career";

function formatMonthYear(isoDate: string | null | undefined): string {
  if (!isoDate) return "Present";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toMonthInput(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  return isoDate.substring(0, 7);
}

interface FormState {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  highlights: string[];
}

const emptyForm: FormState = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
  highlights: [],
};

function experienceToForm(exp: ExperienceData): FormState {
  return {
    company: exp.company,
    title: exp.title,
    location: exp.location ?? "",
    startDate: toMonthInput(exp.startDate),
    endDate: toMonthInput(exp.endDate),
    isCurrent: exp.isCurrent,
    description: exp.description,
    highlights: exp.highlights,
  };
}

function formToData(form: FormState) {
  return {
    company: form.company,
    title: form.title,
    location: form.location || undefined,
    startDate: form.startDate ? `${form.startDate}-01` : "",
    endDate: form.endDate && !form.isCurrent ? `${form.endDate}-01` : undefined,
    isCurrent: form.isCurrent,
    description: form.description,
    highlights: form.highlights.filter((h) => h.trim()),
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

  const set = (field: keyof FormState, value: string | boolean | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleHighlightChange = (index: number, value: string) => {
    const updated = [...form.highlights];
    updated[index] = value;
    set("highlights", updated);
  };

  const addHighlight = () => set("highlights", [...form.highlights, ""]);

  const removeHighlight = (index: number) =>
    set("highlights", form.highlights.filter((_, i) => i !== index));

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
          Description <span className="text-red-500">*</span>
        </label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Brief description of your role and responsibilities..." />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">Highlights</label>
          <button type="button" onClick={addHighlight} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
            + Add highlight
          </button>
        </div>
        <div className="space-y-2">
          {form.highlights.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={h} onChange={(e) => handleHighlightChange(i, e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Highlight ${i + 1}`} />
              <button type="button" onClick={() => removeHighlight(i)}
                className="px-2 py-2 text-red-500 hover:text-red-700 text-sm">
                ✕
              </button>
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
                    {exp.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {exp.highlights.map((h, i) => (
                          <li key={i} className="text-sm text-slate-600 flex gap-2">
                            <span className="text-slate-400 mt-0.5">•</span><span>{h}</span>
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
