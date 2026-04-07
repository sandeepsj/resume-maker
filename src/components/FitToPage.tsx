import { useState, useEffect, useRef } from "react";
import { applyAIEdit } from "@/lib/ai-client";
import type { ResumeContent, ResumeExperience, ResumeEducation, ResumeSkillGroup } from "@/types/resume";

const A4_HEIGHT = 1123; // px at 96dpi

interface FitToPageProps {
  content: ResumeContent;
  accessToken: string;
  onApply: (updated: ResumeContent) => void;
  onClose: () => void;
}

type RemovableItem =
  | { type: "experience"; index: number; label: string }
  | { type: "bullet"; expIndex: number; bulletIndex: number; label: string }
  | { type: "education"; index: number; label: string }
  | { type: "skillGroup"; index: number; label: string }
  | { type: "certification"; index: number; label: string };

export function FitToPage({ content, accessToken, onApply, onClose }: FitToPageProps) {
  const [overflow, setOverflow] = useState(0);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [condensing, setCondensing] = useState(false);
  const [condenseStream, setCondenseStream] = useState("");
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  // Build list of removable items
  const items: RemovableItem[] = [];
  content.experience.forEach((exp, i) => {
    items.push({ type: "experience", index: i, label: `${exp.title} at ${exp.company}` });
    exp.bullets.forEach((b, bi) => {
      items.push({ type: "bullet", expIndex: i, bulletIndex: bi, label: b.length > 80 ? b.slice(0, 80) + "..." : b });
    });
  });
  content.education.forEach((edu, i) => {
    items.push({ type: "education", index: i, label: `${edu.degree}${edu.field ? ` in ${edu.field}` : ""} — ${edu.institution}` });
  });
  content.skills.forEach((g, i) => {
    items.push({ type: "skillGroup", index: i, label: `${g.category}: ${g.skills.join(", ")}` });
  });
  content.certifications?.forEach((c, i) => {
    items.push({ type: "certification", index: i, label: `${c.name} · ${c.issuer}` });
  });

  function itemKey(item: RemovableItem): string {
    if (item.type === "bullet") return `bullet-${item.expIndex}-${item.bulletIndex}`;
    return `${item.type}-${item.index}`;
  }

  function toggle(key: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Build preview content with removed items filtered out
  function buildPreview(): ResumeContent {
    const removedExpIndexes = new Set<number>();
    const removedBullets = new Map<number, Set<number>>();
    const removedEduIndexes = new Set<number>();
    const removedSkillIndexes = new Set<number>();
    const removedCertIndexes = new Set<number>();

    for (const key of removed) {
      const parts = key.split("-");
      if (parts[0] === "experience") removedExpIndexes.add(Number(parts[1]));
      if (parts[0] === "bullet") {
        const ei = Number(parts[1]);
        if (!removedBullets.has(ei)) removedBullets.set(ei, new Set());
        removedBullets.get(ei)!.add(Number(parts[2]));
      }
      if (parts[0] === "education") removedEduIndexes.add(Number(parts[1]));
      if (parts[0] === "skillGroup") removedSkillIndexes.add(Number(parts[1]));
      if (parts[0] === "certification") removedCertIndexes.add(Number(parts[1]));
    }

    return {
      ...content,
      experience: content.experience
        .filter((_, i) => !removedExpIndexes.has(i))
        .map((exp, origI) => {
          // Find original index before filtering
          let realIndex = -1;
          for (let j = 0; j <= origI; j++) {
            realIndex++;
            while (removedExpIndexes.has(realIndex)) realIndex++;
          }
          const bulletRemovals = removedBullets.get(realIndex);
          if (!bulletRemovals) return exp;
          return { ...exp, bullets: exp.bullets.filter((_, bi) => !bulletRemovals.has(bi)) };
        }),
      education: content.education.filter((_, i) => !removedEduIndexes.has(i)),
      skills: content.skills.filter((_, i) => !removedSkillIndexes.has(i)),
      certifications: content.certifications?.filter((_, i) => !removedCertIndexes.has(i)),
    };
  }

  // Simpler approach: rebuild from original indexes directly
  function buildCleanContent(): ResumeContent {
    const removedExpIndexes = new Set<number>();
    const removedBullets = new Map<number, Set<number>>();
    const removedEduIndexes = new Set<number>();
    const removedSkillIndexes = new Set<number>();
    const removedCertIndexes = new Set<number>();

    for (const key of removed) {
      const parts = key.split("-");
      if (parts[0] === "experience") removedExpIndexes.add(Number(parts[1]));
      if (parts[0] === "bullet") {
        const ei = Number(parts[1]);
        if (!removedBullets.has(ei)) removedBullets.set(ei, new Set());
        removedBullets.get(ei)!.add(Number(parts[2]));
      }
      if (parts[0] === "education") removedEduIndexes.add(Number(parts[1]));
      if (parts[0] === "skillGroup") removedSkillIndexes.add(Number(parts[1]));
      if (parts[0] === "certification") removedCertIndexes.add(Number(parts[1]));
    }

    return {
      ...content,
      experience: content.experience
        .map((exp, i) => {
          if (removedExpIndexes.has(i)) return null;
          const bulletRemovals = removedBullets.get(i);
          if (!bulletRemovals) return exp;
          return { ...exp, bullets: exp.bullets.filter((_, bi) => !bulletRemovals.has(bi)) };
        })
        .filter(Boolean) as ResumeExperience[],
      education: content.education.filter((_, i) => !removedEduIndexes.has(i)),
      skills: content.skills.filter((_, i) => !removedSkillIndexes.has(i)),
      certifications: content.certifications?.filter((_, i) => !removedCertIndexes.has(i)),
    };
  }

  // Measure overflow on the hidden print-style preview
  useEffect(() => {
    requestAnimationFrame(() => {
      if (previewRef.current) {
        const h = previewRef.current.scrollHeight;
        setOverflow(Math.max(0, h - A4_HEIGHT));
      }
    });
  }, [content, removed]);

  const previewContent = buildCleanContent();
  const fitsPage = overflow <= 0;

  const handleApplyRemovals = () => {
    onApply(buildCleanContent());
  };

  const handleCondenseWithAI = async () => {
    setCondensing(true);
    setCondenseStream("");
    setError("");

    const cleaned = buildCleanContent();

    try {
      const { updatedResume } = await applyAIEdit({
        systemPrompt: `You are condensing a professional resume to fit on a single A4 page. The resume currently overflows by approximately ${overflow}px (about ${Math.ceil(overflow / 20)} lines).

Rules:
- Shorten bullet points — keep the impact but use fewer words
- Reduce bullets per role to 2-3 max if there are more
- Shorten the summary to 1-2 sentences
- Merge similar skill categories if possible
- Do NOT remove entire sections or experiences — just make everything more concise
- Preserve action verbs and quantified achievements
- Return ONLY valid JSON, no markdown fences`,
        userPrompt: `CURRENT RESUME JSON:
${JSON.stringify(cleaned, null, 2)}

Return a JSON object with:
{
  "updatedResume": { ...condensed ResumeContent... },
  "explanation": "string describing what was condensed"
}

Condense now:`,
        accessToken,
        onChunk: (text) => setCondenseStream((prev) => prev + text),
      });

      onApply(updatedResume);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Condense failed");
      setCondensing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900">Fit to Page</h3>
            <p className={`text-xs mt-0.5 ${fitsPage ? "text-green-600" : "text-red-600"}`}>
              {fitsPage
                ? "Resume fits on one A4 page"
                : `Overflows by ~${Math.ceil(overflow / 20)} lines (${overflow}px)`}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${fitsPage ? "bg-green-500" : "bg-red-500"}`} />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Experience */}
          <Section title="Experience">
            {content.experience.map((exp, i) => {
              const expKey = `experience-${i}`;
              const expRemoved = removed.has(expKey);
              return (
                <div key={expKey}>
                  <ItemRow
                    label={`${exp.title} at ${exp.company}`}
                    checked={!expRemoved}
                    onChange={() => toggle(expKey)}
                    bold
                  />
                  {!expRemoved && exp.bullets.map((b, bi) => {
                    const bKey = `bullet-${i}-${bi}`;
                    return (
                      <ItemRow
                        key={bKey}
                        label={b.length > 90 ? b.slice(0, 90) + "..." : b}
                        checked={!removed.has(bKey)}
                        onChange={() => toggle(bKey)}
                        indent
                      />
                    );
                  })}
                </div>
              );
            })}
          </Section>

          {/* Education */}
          {content.education.length > 0 && (
            <Section title="Education">
              {content.education.map((edu, i) => (
                <ItemRow
                  key={`education-${i}`}
                  label={`${edu.degree}${edu.field ? ` in ${edu.field}` : ""} — ${edu.institution}`}
                  checked={!removed.has(`education-${i}`)}
                  onChange={() => toggle(`education-${i}`)}
                />
              ))}
            </Section>
          )}

          {/* Skills */}
          {content.skills.length > 0 && (
            <Section title="Skills">
              {content.skills.map((g, i) => (
                <ItemRow
                  key={`skillGroup-${i}`}
                  label={`${g.category}: ${g.skills.join(", ")}`}
                  checked={!removed.has(`skillGroup-${i}`)}
                  onChange={() => toggle(`skillGroup-${i}`)}
                />
              ))}
            </Section>
          )}

          {/* Certifications */}
          {content.certifications && content.certifications.length > 0 && (
            <Section title="Certifications">
              {content.certifications.map((c, i) => (
                <ItemRow
                  key={`certification-${i}`}
                  label={`${c.name} · ${c.issuer}`}
                  checked={!removed.has(`certification-${i}`)}
                  onChange={() => toggle(`certification-${i}`)}
                />
              ))}
            </Section>
          )}

          {/* AI condense */}
          {condenseStream && (
            <div className="p-3 bg-slate-50 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-1 font-medium">Condensing...</p>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{condenseStream}</pre>
            </div>
          )}
          {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={handleCondenseWithAI}
            disabled={condensing}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {condensing ? "Condensing..." : "Condense with AI"}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={condensing}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleApplyRemovals} disabled={removed.size === 0 || condensing}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
              Apply ({removed.size} removed)
            </button>
          </div>
        </div>
      </div>

      {/* Hidden A4 preview for measuring overflow */}
      <div className="fixed left-[-9999px] top-0" aria-hidden>
        <div
          ref={previewRef}
          className="w-[794px] bg-white px-[60px] py-[48px]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <PrintPreview content={previewContent} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ItemRow({ label, checked, onChange, bold, indent }: {
  label: string; checked: boolean; onChange: () => void; bold?: boolean; indent?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2.5 py-1 cursor-pointer group ${indent ? "pl-6" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange}
        className="mt-0.5 w-4 h-4 rounded text-blue-500 shrink-0" />
      <span className={`text-sm leading-snug ${
        checked
          ? bold ? "text-slate-900 font-medium" : "text-slate-700"
          : "text-slate-400 line-through"
      }`}>
        {indent && <span className="text-slate-300 mr-1">•</span>}
        {label}
      </span>
    </label>
  );
}

/** Minimal print-style rendering for measuring height */
function PrintPreview({ content }: { content: ResumeContent }) {
  const { header, summary, experience, education, skills, certifications } = content;
  return (
    <>
      <div className="mb-5 pb-4 border-b border-slate-300">
        <h1 className="text-[26px] font-bold leading-tight">{header.name}</h1>
        {header.headline && <p className="text-[13px] mt-1">{header.headline}</p>}
        <div className="flex flex-wrap gap-x-3 mt-2 text-[11px]">
          <span>{header.email}</span>
          {header.phone && <span>· {header.phone}</span>}
          {header.location && <span>· {header.location}</span>}
        </div>
      </div>
      {summary && (
        <div className="mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-1.5">Summary</h2>
          <p className="text-[11.5px] leading-relaxed">{summary}</p>
        </div>
      )}
      {experience.length > 0 && (
        <div className="mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Experience</h2>
          <div className="space-y-3.5">
            {experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <div>
                    <p className="text-[12px] font-semibold">{exp.title}</p>
                    <p className="text-[11px]">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</p>
                  </div>
                  <p className="text-[10.5px] shrink-0 ml-3">{exp.startDate} — {exp.endDate ?? "Present"}</p>
                </div>
                {exp.bullets.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-1">
                    {exp.bullets.map((b, bi) => (
                      <li key={bi} className="flex gap-2 text-[11px] leading-snug">
                        <span className="shrink-0 mt-0.5">•</span><span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {education.length > 0 && (
        <div className="mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Education</h2>
          {education.map((edu, i) => (
            <div key={i} className="flex justify-between mb-1">
              <div>
                <p className="text-[12px] font-semibold">{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</p>
                <p className="text-[11px]">{edu.institution}</p>
              </div>
              <p className="text-[10.5px] shrink-0 ml-3">{edu.graduationDate}</p>
            </div>
          ))}
        </div>
      )}
      {skills.length > 0 && (
        <div className="mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Skills</h2>
          {skills.map((g, i) => (
            <div key={i} className="flex gap-2 text-[11px]">
              <span className="font-semibold shrink-0 w-[130px]">{g.category}:</span>
              <span>{g.skills.join(", ")}</span>
            </div>
          ))}
        </div>
      )}
      {certifications && certifications.length > 0 && (
        <div className="mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Certifications</h2>
          {certifications.map((c, i) => (
            <div key={i} className="text-[11px]">
              <span className="font-medium">{c.name}</span> · {c.issuer}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
