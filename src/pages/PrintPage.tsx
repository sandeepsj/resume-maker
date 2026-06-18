import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getResume } from "@/lib/google-drive";
import { PrintTrigger } from "@/components/PrintTrigger";
import { RichText } from "@/components/RichText";
import type { ResumeContent } from "@/types/resume";

export function PrintPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resumeId) return;
    let attempts = 0;
    const tryLoad = () => {
      getResume(resumeId)
        .then((r) => {
          if (r?.content) {
            setContent(r.content);
            setLoading(false);
          } else if (attempts < 2) {
            // Retry once — Drive folder cache may be cold in new tab
            attempts++;
            setTimeout(tryLoad, 1000);
          } else {
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Print page load error:", err);
          if (attempts < 2) {
            attempts++;
            setTimeout(tryLoad, 1000);
          } else {
            setLoading(false);
          }
        });
    };
    tryLoad();
  }, [resumeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!content) {
    return <div className="p-8 text-center text-slate-500">Resume not found or has no content.</div>;
  }

  const { header, summary, experience, education, skills, certifications } = content;

  return (
    <>
      <PrintTrigger />

      <div id="resume-print" className="w-[794px] min-h-[1123px] mx-auto bg-white px-[60px] py-[48px] print:w-full print:min-h-0 print:px-0 print:py-0 print:mx-0">
        <div className="mb-5 pb-4 border-b border-slate-300">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">{header.name}</h1>
          {header.headline && <p className="text-[13px] text-slate-600 mt-1">{header.headline}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-slate-500">
            <span>{header.email}</span>
            {header.phone && <span>· {header.phone}</span>}
            {header.location && <span>· {header.location}</span>}
            {header.linkedinUrl && <span>· {header.linkedinUrl}</span>}
            {header.githubUrl && <span>· {header.githubUrl}</span>}
            {header.portfolioUrl && <span>· {header.portfolioUrl}</span>}
          </div>
        </div>

        {summary && (
          <div className="mb-4">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-1.5">Summary</h2>
            <p className="text-[11.5px] text-slate-700 leading-relaxed"><RichText text={summary} /></p>
          </div>
        )}

        {experience.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-2">Experience</h2>
            <div className="space-y-3.5">
              {experience.map((exp, i) => (
                <div key={exp.id ?? i}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-900">{exp.title}</p>
                      <p className="text-[11px] text-slate-600">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</p>
                    </div>
                    <p className="text-[10.5px] text-slate-500 shrink-0 ml-3">{exp.startDate} — {exp.endDate ?? "Present"}</p>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-1">
                      {exp.bullets.map((b, bi) => (
                        <li key={bi} className="flex gap-2 text-[11px] text-slate-700 leading-snug">
                          <span className="text-slate-400 shrink-0 mt-0.5">•</span><span><RichText text={b} /></span>
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
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-2">Education</h2>
            <div className="space-y-2">
              {education.map((edu, i) => (
                <div key={edu.id ?? i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900">{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</p>
                    <p className="text-[11px] text-slate-600">{edu.institution}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10.5px] text-slate-500">{edu.graduationDate}</p>
                    {(edu.gpa || edu.honors) && <p className="text-[10.5px] text-slate-500">{[edu.gpa && `GPA: ${edu.gpa}`, edu.honors].filter(Boolean).join(" · ")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-2">Skills</h2>
            <div className="space-y-1">
              {skills.map((group, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="font-semibold text-slate-700 shrink-0 w-[130px]">{group.category}:</span>
                  <span className="text-slate-600">{group.skills.join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {certifications && certifications.length > 0 && (
          <div className="mb-4">
            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-2">Certifications</h2>
            <div className="space-y-1">
              {certifications.map((cert, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span><span className="font-medium text-slate-900">{cert.name}</span><span className="text-slate-500"> · {cert.issuer}</span></span>
                  {cert.date && <span className="text-slate-400 text-[10.5px]">{cert.date}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
