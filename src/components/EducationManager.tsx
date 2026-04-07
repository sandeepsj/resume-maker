import { useState } from "react";
import { addEducationItem, updateEducationItem, deleteEducationItem } from "@/lib/google-drive";
import type { EducationData } from "@/types/career";

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
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
  honors: string;
  activities: string[];
}

const emptyForm: FormState = {
  institution: "", degree: "", field: "", startDate: "", endDate: "",
  gpa: "", honors: "", activities: [],
};

function educationToForm(edu: EducationData): FormState {
  return {
    institution: edu.institution, degree: edu.degree, field: edu.field ?? "",
    startDate: toMonthInput(edu.startDate), endDate: toMonthInput(edu.endDate),
    gpa: edu.gpa ?? "", honors: edu.honors ?? "", activities: edu.activities,
  };
}

function formToData(form: FormState) {
  return {
    institution: form.institution, degree: form.degree,
    field: form.field || undefined,
    startDate: form.startDate ? `${form.startDate}-01` : "",
    endDate: form.endDate ? `${form.endDate}-01` : undefined,
    gpa: form.gpa || undefined, honors: form.honors || undefined,
    activities: form.activities.filter((a) => a.trim()),
  };
}

interface EducationFormProps {
  initial: FormState;
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function EducationForm({ initial, onSave, onCancel, saving }: EducationFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (field: keyof FormState, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Institution <span className="text-red-500">*</span></label>
          <input type="text" value={form.institution} onChange={(e) => set("institution", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="MIT" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Degree <span className="text-red-500">*</span></label>
          <input type="text" value={form.degree} onChange={(e) => set("degree", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Bachelor of Science" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Field of Study</label>
        <input type="text" value={form.field} onChange={(e) => set("field", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Computer Science" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
          <input type="month" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End Date (or Expected)</label>
          <input type="month" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">GPA</label>
          <input type="text" value={form.gpa} onChange={(e) => set("gpa", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="3.9/4.0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Honors</label>
          <input type="text" value={form.honors} onChange={(e) => set("honors", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Summa Cum Laude" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">Activities & Clubs</label>
          <button type="button" onClick={() => set("activities", [...form.activities, ""])}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ Add activity</button>
        </div>
        <div className="space-y-2">
          {form.activities.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={a}
                onChange={(e) => { const u = [...form.activities]; u[i] = e.target.value; set("activities", u); }}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Activity ${i + 1}`} />
              <button type="button" onClick={() => set("activities", form.activities.filter((_, j) => j !== i))}
                className="px-2 py-2 text-red-500 hover:text-red-700 text-sm">✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => onSave(form)}
          disabled={saving || !form.institution || !form.degree || !form.startDate}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors">Cancel</button>
      </div>
    </div>
  );
}

interface EducationManagerProps { initialEducations: EducationData[]; }

export function EducationManager({ initialEducations }: EducationManagerProps) {
  const [educations, setEducations] = useState<EducationData[]>(initialEducations);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (form: FormState) => {
    setSaving(true); setError(null);
    try {
      const created = await addEducationItem(formToData(form) as Omit<EducationData, "id">);
      setEducations((prev) => [created, ...prev]);
      setShowForm(false);
    } catch { setError("Failed to save education. Please try again."); }
    finally { setSaving(false); }
  };

  const handleEdit = async (id: string, form: FormState) => {
    setSaving(true); setError(null);
    try {
      const data = formToData(form);
      await updateEducationItem(id, data);
      setEducations((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
      setEditingId(null);
    } catch { setError("Failed to update education. Please try again."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this education entry? This cannot be undone.")) return;
    try { await deleteEducationItem(id); setEducations((prev) => prev.filter((e) => e.id !== id)); }
    catch { setError("Failed to delete. Please try again."); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Education</h1>
          <p className="text-slate-500 mt-1 text-sm">Add your educational background.</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); }}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            + Add Education
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="mb-6">
          <EducationForm initial={emptyForm} onSave={handleAdd} onCancel={() => setShowForm(false)} saving={saving} />
        </div>
      )}

      {educations.length === 0 && !showForm ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">No education entries added yet.</p>
          <p className="text-slate-400 text-sm mb-6">Add your educational background for AI-tailored resumes.</p>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-3 font-medium transition-colors">
            Add your education
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {educations.map((edu) =>
            editingId === edu.id ? (
              <EducationForm key={edu.id} initial={educationToForm(edu)}
                onSave={(form) => handleEdit(edu.id, form)} onCancel={() => setEditingId(null)} saving={saving} />
            ) : (
              <div key={edu.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</h3>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700">{edu.institution}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{formatMonthYear(edu.startDate)} — {formatMonthYear(edu.endDate)}</p>
                    {(edu.gpa || edu.honors) && (
                      <p className="text-sm text-slate-600 mt-1">{[edu.gpa && `GPA: ${edu.gpa}`, edu.honors].filter(Boolean).join(" · ")}</p>
                    )}
                    {edu.activities.length > 0 && <p className="text-sm text-slate-500 mt-1">Activities: {edu.activities.join(", ")}</p>}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button onClick={() => { setEditingId(edu.id); setShowForm(false); }}
                      className="text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                    <button onClick={() => handleDelete(edu.id)}
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
