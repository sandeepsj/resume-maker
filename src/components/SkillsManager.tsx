import { useState } from "react";
import { addSkill, deleteSkill } from "@/lib/google-drive";
import type { SkillData, SkillCategory, SkillLevel } from "@/types/career";

const CATEGORIES: SkillCategory[] = ["TECHNICAL", "LANGUAGE", "SOFT", "TOOL", "FRAMEWORK", "CERTIFICATION"];
const LEVELS: SkillLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  TECHNICAL: "Technical", LANGUAGE: "Languages", SOFT: "Soft Skills",
  TOOL: "Tools", FRAMEWORK: "Frameworks", CERTIFICATION: "Certifications",
};

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  TECHNICAL: "bg-blue-100 text-blue-800 border-blue-200",
  LANGUAGE: "bg-purple-100 text-purple-800 border-purple-200",
  SOFT: "bg-green-100 text-green-800 border-green-200",
  TOOL: "bg-orange-100 text-orange-800 border-orange-200",
  FRAMEWORK: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CERTIFICATION: "bg-red-100 text-red-800 border-red-200",
};

const LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", EXPERT: "Expert",
};

interface SkillsManagerProps { initialSkills: SkillData[]; }

export function SkillsManager({ initialSkills }: SkillsManagerProps) {
  const [skills, setSkills] = useState<SkillData[]>(initialSkills);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SkillCategory>("TECHNICAL");
  const [level, setLevel] = useState<SkillLevel>("INTERMEDIATE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = CATEGORIES.reduce<Record<SkillCategory, SkillData[]>>(
    (acc, cat) => { acc[cat] = skills.filter((s) => s.category === cat); return acc; },
    {} as Record<SkillCategory, SkillData[]>
  );

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try {
      const created = await addSkill({ name: name.trim(), category, level });
      setSkills((prev) => [...prev, created]);
      setName(""); setCategory("TECHNICAL"); setLevel("INTERMEDIATE"); setShowForm(false);
    } catch { setError("Failed to add skill. Please try again."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteSkill(id); setSkills((prev) => prev.filter((s) => s.id !== id)); }
    catch { setError("Failed to delete skill. Please try again."); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Skills</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage your skills to power resume generation.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            + Add Skill
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h3 className="font-medium text-slate-900 mb-4">Add a Skill</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Skill Name <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. TypeScript" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as SkillCategory)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={handleAdd} disabled={saving || !name.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? "Adding..." : "Add Skill"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setName(""); }}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {skills.length === 0 && !showForm ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">No skills added yet.</p>
          <p className="text-slate-400 text-sm mb-6">Add your technical skills, languages, and tools.</p>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-3 font-medium transition-colors">
            Add your first skill
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const catSkills = grouped[cat];
            if (catSkills.length === 0) return null;
            return (
              <div key={cat} className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{CATEGORY_LABELS[cat]}</h2>
                <div className="flex flex-wrap gap-2">
                  {catSkills.map((skill) => (
                    <div key={skill.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${CATEGORY_COLORS[cat]}`}>
                      <span>{skill.name}</span>
                      <span className="opacity-60 text-xs">· {LEVEL_LABELS[skill.level]}</span>
                      <button onClick={() => handleDelete(skill.id)}
                        className="ml-1 opacity-60 hover:opacity-100 text-xs leading-none transition-opacity" title="Remove skill">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
