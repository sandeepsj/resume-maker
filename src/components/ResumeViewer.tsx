import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  addComment as driveAddComment,
  updateComment as driveUpdateComment,
  deleteComment as driveDeleteComment,
  updateResume,
  getExperiences,
  getEducation,
  getSkills,
  getProfile,
} from "@/lib/google-drive";
import { generateResume, applyAIEdit } from "@/lib/ai-client";
import {
  GENERATE_RESUME_SYSTEM_PROMPT,
  buildGenerateResumePrompt,
} from "@/prompts/generate-resume";
import {
  APPLY_COMMENT_SYSTEM_PROMPT,
  buildApplyCommentPrompt,
} from "@/prompts/apply-comment";
import {
  ADD_EXPERIENCE_SYSTEM_PROMPT,
  buildAddExperiencePrompt,
} from "@/prompts/add-experience";
import type { CommentData } from "@/lib/google-drive";
import type { ResumeContent } from "@/types/resume";
import type { ExperienceData } from "@/types/career";
import { FitToPage } from "@/components/FitToPage";

interface FloatingButton {
  x: number;
  y: number;
  sectionKey: string;
  selectedText: string;
  anchorOffset: number;
  focusOffset: number;
}

interface ResumeViewerProps {
  resumeId: string;
  content: ResumeContent;
  resumeTitle: string;
  initialComments: CommentData[];
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate || isoDate === "Present") return "Present";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  APPLIED: "bg-green-100 text-green-700",
  DISMISSED: "bg-slate-100 text-slate-500",
};

export function ResumeViewer({
  resumeId,
  content: initialContent,
  resumeTitle,
  initialComments,
  jobTitle,
  companyName,
  jobDescription,
}: ResumeViewerProps) {
  const { accessToken, user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const [floatingBtn, setFloatingBtn] = useState<FloatingButton | null>(null);
  const [commentPopover, setCommentPopover] = useState<{
    sectionKey: string; selectedText: string; anchorOffset: number; focusOffset: number;
  } | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [applyingCommentId, setApplyingCommentId] = useState<string | null>(null);
  const [applyStreamText, setApplyStreamText] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [regenStreaming, setRegenStreaming] = useState(false);
  const [regenStreamText, setRegenStreamText] = useState("");
  const [regenError, setRegenError] = useState("");
  const [addExpOpen, setAddExpOpen] = useState(false);
  const [allExperiences, setAllExperiences] = useState<ExperienceData[]>([]);
  const [addExpLoading, setAddExpLoading] = useState(false);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [addExpNotes, setAddExpNotes] = useState("");
  const [addExpStreaming, setAddExpStreaming] = useState(false);
  const [addExpStreamText, setAddExpStreamText] = useState("");
  const [addExpError, setAddExpError] = useState("");
  const [fitToPageOpen, setFitToPageOpen] = useState(false);
  const [pageOverflow, setPageOverflow] = useState(0);
  const resumeRef = useRef<HTMLDivElement>(null);
  const printMeasureRef = useRef<HTMLDivElement>(null);

  // Measure page overflow whenever content changes
  useEffect(() => {
    requestAnimationFrame(() => {
      if (printMeasureRef.current) {
        const h = printMeasureRef.current.scrollHeight;
        setPageOverflow(Math.max(0, h - 1123)); // A4 = 1123px at 96dpi
      }
    });
  }, [content]);

  // --- Text selection ---
  const evaluateSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setFloatingBtn(null); return; }
    const selectedText = sel.toString().trim();
    const range = sel.getRangeAt(0);
    if (!resumeRef.current?.contains(range.commonAncestorContainer)) { setFloatingBtn(null); return; }

    let node: Node | null = range.commonAncestorContainer;
    let sectionKey = "";
    while (node && node !== resumeRef.current) {
      if (node instanceof Element) {
        const key = node.getAttribute("data-section-key");
        if (key) { sectionKey = key; break; }
      }
      node = node.parentNode;
    }
    if (!sectionKey) { setFloatingBtn(null); return; }

    const rect = range.getBoundingClientRect();
    setFloatingBtn({ x: rect.left + rect.width / 2, y: rect.bottom + 8, sectionKey, selectedText, anchorOffset: range.startOffset, focusOffset: range.endOffset });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const h = () => { clearTimeout(timer); timer = setTimeout(evaluateSelection, 120); };
    document.addEventListener("selectionchange", h);
    return () => { document.removeEventListener("selectionchange", h); clearTimeout(timer); };
  }, [evaluateSelection]);

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (floatingBtn && !(e.target as Element)?.closest("[data-float-btn]")) setFloatingBtn(null);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [floatingBtn]);

  // --- Comment CRUD ---
  const handleAddComment = () => {
    if (!floatingBtn) return;
    setCommentPopover({ sectionKey: floatingBtn.sectionKey, selectedText: floatingBtn.selectedText, anchorOffset: floatingBtn.anchorOffset, focusOffset: floatingBtn.focusOffset });
    setFloatingBtn(null); setCommentBody(""); window.getSelection()?.removeAllRanges();
  };

  const handleSaveComment = async () => {
    if (!commentPopover || !commentBody.trim()) return;
    setSavingComment(true);
    try {
      const created = await driveAddComment(resumeId, {
        sectionKey: commentPopover.sectionKey,
        selectedText: commentPopover.selectedText,
        anchorOffset: commentPopover.anchorOffset,
        focusOffset: commentPopover.focusOffset,
        body: commentBody.trim(),
      });
      setComments((prev) => [created, ...prev]);
      setCommentPopover(null); setCommentBody(""); setSidebarOpen(true);
    } catch { alert("Failed to save comment."); }
    finally { setSavingComment(false); }
  };

  const handleDismiss = async (commentId: string) => {
    try {
      await driveUpdateComment(resumeId, commentId, { status: "DISMISSED" });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, status: "DISMISSED" } : c)));
    } catch { alert("Failed to dismiss comment."); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await driveDeleteComment(resumeId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { alert("Failed to delete comment."); }
  };

  // --- AI: Apply comment edit ---
  const handleApplyAiEdit = async (commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    setApplyingCommentId(commentId);
    setApplyStreamText((prev) => ({ ...prev, [commentId]: "" }));

    try {
      await driveUpdateComment(resumeId, commentId, { status: "PROCESSING" });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, status: "PROCESSING" } : c)));

      const userPrompt = buildApplyCommentPrompt({
        resumeContent: content,
        sectionKey: comment.sectionKey,
        selectedText: comment.selectedText,
        commentBody: comment.body,
      });

      const { updatedResume, explanation } = await applyAIEdit({
        systemPrompt: APPLY_COMMENT_SYSTEM_PROMPT,
        userPrompt,
        accessToken: accessToken!,
        onChunk: (text) => setApplyStreamText((prev) => ({ ...prev, [commentId]: (prev[commentId] ?? "") + text })),
      });

      await updateResume(resumeId, { content: updatedResume });
      setContent(updatedResume);

      const aiResponse = String(explanation);
      await driveUpdateComment(resumeId, commentId, {
        status: "APPLIED",
        aiResponse,
        resolvedAt: new Date().toISOString(),
      });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, status: "APPLIED", aiResponse } : c)));
      setApplyingCommentId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply edit");
      await driveUpdateComment(resumeId, commentId, { status: "PENDING" }).catch(() => {});
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, status: "PENDING" } : c)));
      setApplyingCommentId(null);
    }
  };

  // --- AI: Regenerate ---
  const handleRegen = async () => {
    setRegenStreaming(true); setRegenStreamText(""); setRegenError("");

    try {
      const [allExp, edu, sk, prof] = await Promise.all([
        getExperiences(), getEducation(), getSkills(), getProfile(),
      ]);

      const userPrompt = buildGenerateResumePrompt({
        profile: prof,
        userEmail: user?.email || "",
        userName: user?.name || "",
        experiences: allExp,
        educations: edu,
        skills: sk,
        jobTitle: jobTitle || "",
        companyName: companyName || "",
        jobDescription: jobDescription || "",
        customInstructions: regenInstructions,
      });

      const newContent = await generateResume({
        systemPrompt: GENERATE_RESUME_SYSTEM_PROMPT,
        userPrompt,
        accessToken: accessToken!,
        onChunk: (text) => setRegenStreamText((prev) => prev + text),
      });

      await updateResume(resumeId, { content: newContent, status: "READY" });
      setContent(newContent);
      setRegenOpen(false); setRegenStreaming(false);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
      setRegenStreaming(false);
    }
  };

  // --- AI: Add experience ---
  const openAddExpModal = async () => {
    setAddExpOpen(true); setAddExpLoading(true); setSelectedExpId(null); setAddExpNotes(""); setAddExpStreamText(""); setAddExpError("");
    try {
      const data = await getExperiences();
      setAllExperiences(data);
    } catch { setAddExpError("Failed to load experiences."); }
    finally { setAddExpLoading(false); }
  };

  const handleAddExp = async () => {
    if (!selectedExpId) return;
    setAddExpStreaming(true); setAddExpStreamText(""); setAddExpError("");

    const experience = allExperiences.find((e) => e.id === selectedExpId);
    if (!experience) return;

    try {
      const userPrompt = buildAddExperiencePrompt({
        resumeContent: content,
        experience,
        notes: addExpNotes,
      });

      const { updatedResume } = await applyAIEdit({
        systemPrompt: ADD_EXPERIENCE_SYSTEM_PROMPT,
        userPrompt,
        accessToken: accessToken!,
        onChunk: (text) => setAddExpStreamText((prev) => prev + text),
      });

      await updateResume(resumeId, { content: updatedResume });
      setContent(updatedResume);
      setAddExpOpen(false); setAddExpStreaming(false);
    } catch (err) {
      setAddExpError(err instanceof Error ? err.message : "Failed to add experience");
      setAddExpStreaming(false);
    }
  };

  const { header, summary, experience, education, skills, certifications } = content;
  const activeComments = comments.filter((c) => c.status !== "DISMISSED");
  const experienceIdsInResume = new Set(experience.map((e) => e.id));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/resumes" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">← Back to Resumes</Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{resumeTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          {pageOverflow > 0 && (
            <button onClick={() => setFitToPageOpen(true)}
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-red-100 transition-colors">
              Overflows A4 — Fit to Page
            </button>
          )}
          {pageOverflow <= 0 && (
            <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">Fits A4</span>
          )}
          <button onClick={() => setSidebarOpen((v) => !v)}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 text-sm transition-colors">
            {sidebarOpen ? "Hide" : "Show"} Comments ({activeComments.length})
          </button>
          <button onClick={() => { setRegenOpen(true); setRegenInstructions(""); setRegenStreamText(""); setRegenError(""); }}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 text-sm transition-colors">Regenerate</button>
          <button onClick={openAddExpModal}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 text-sm transition-colors">+ Add Experience</button>
          <Link to={`/resumes/${resumeId}/print`} target="_blank"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors">Export PDF</Link>
        </div>
      </div>

      <div className="flex">
        <div className={`flex-1 overflow-auto p-8 ${sidebarOpen ? "mr-80" : ""}`}>
          <div ref={resumeRef} className="w-[794px] mx-auto bg-white shadow-sm border border-slate-200 rounded-xl p-10 select-text">
            {/* Header */}
            <div data-section-key="header" className="mb-6 pb-6 border-b border-slate-200">
              <h1 className="text-3xl font-bold text-slate-900">{header.name}</h1>
              {header.headline && <p className="text-lg text-slate-600 mt-1">{header.headline}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-500">
                <span>{header.email}</span>
                {header.phone && <span>{header.phone}</span>}
                {header.location && <span>{header.location}</span>}
                {header.linkedinUrl && <a href={header.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">LinkedIn</a>}
                {header.githubUrl && <a href={header.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">GitHub</a>}
                {header.portfolioUrl && <a href={header.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Portfolio</a>}
              </div>
            </div>
            {/* Summary */}
            {summary && (
              <div data-section-key="summary" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Summary</h2>
                <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
              </div>
            )}
            {/* Experience */}
            {experience.length > 0 && (
              <div data-section-key="experience" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Experience</h2>
                <div className="space-y-5">
                  {experience.map((exp, i) => (
                    <div key={exp.id ?? i} data-section-key={`experience-${exp.id ?? i}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm">{exp.title}</h3>
                          <p className="text-sm text-slate-600">{exp.company}{exp.location && ` · ${exp.location}`}</p>
                        </div>
                        <p className="text-xs text-slate-500 shrink-0 ml-4">{formatDate(exp.startDate)} — {formatDate(exp.endDate)}</p>
                      </div>
                      {exp.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {exp.bullets.map((bullet, bi) => (
                            <li key={bi} className="flex gap-2 text-sm text-slate-700"><span className="text-slate-400 mt-0.5 shrink-0">•</span><span>{bullet}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Education */}
            {education.length > 0 && (
              <div data-section-key="education" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Education</h2>
                <div className="space-y-4">
                  {education.map((edu, i) => (
                    <div key={edu.id ?? i} data-section-key={`education-${edu.id ?? i}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm">{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</h3>
                          <p className="text-sm text-slate-600">{edu.institution}</p>
                          {(edu.gpa || edu.honors) && <p className="text-xs text-slate-500 mt-0.5">{[edu.gpa && `GPA: ${edu.gpa}`, edu.honors].filter(Boolean).join(" · ")}</p>}
                        </div>
                        <p className="text-xs text-slate-500 shrink-0 ml-4">{formatDate(edu.graduationDate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Skills */}
            {skills.length > 0 && (
              <div data-section-key="skills" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Skills</h2>
                <div className="space-y-1.5">
                  {skills.map((group, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-medium text-slate-700 shrink-0 w-32">{group.category}:</span>
                      <span className="text-slate-600">{group.skills.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Certifications */}
            {certifications && certifications.length > 0 && (
              <div data-section-key="certifications" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Certifications</h2>
                <div className="space-y-1.5">
                  {certifications.map((cert, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div><span className="font-medium text-slate-900">{cert.name}</span><span className="text-slate-500"> · {cert.issuer}</span></div>
                      {cert.date && <span className="text-xs text-slate-400">{cert.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comments sidebar */}
        {sidebarOpen && (
          <div className="w-80 fixed right-0 top-[57px] bottom-0 bg-white border-l border-slate-200 overflow-y-auto">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Comments ({activeComments.length})</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select text in the resume to add a comment.</p>
            </div>
            {activeComments.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400">No comments yet.</p>
                <p className="text-xs text-slate-400 mt-1">Select text in the resume to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeComments.map((comment) => (
                  <div key={comment.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs text-slate-500 italic line-clamp-2">&ldquo;{comment.selectedText}&rdquo;</p>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[comment.status] ?? "bg-slate-100 text-slate-500"}`}>{comment.status}</span>
                    </div>
                    <p className="text-sm text-slate-700 mb-1">{comment.body}</p>
                    {comment.aiResponse && <p className="text-xs text-green-700 bg-green-50 rounded p-2 mt-2">{comment.aiResponse}</p>}
                    {applyingCommentId === comment.id && applyStreamText[comment.id] && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 max-h-20 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-mono">{applyStreamText[comment.id]}</pre>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      {comment.status === "PENDING" && (
                        <button onClick={() => handleApplyAiEdit(comment.id)} disabled={applyingCommentId === comment.id}
                          className="text-xs bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-1 font-medium disabled:opacity-50 transition-colors">
                          {applyingCommentId === comment.id ? "Applying..." : "Apply AI Edit"}
                        </button>
                      )}
                      {comment.status === "PENDING" && (
                        <button onClick={() => handleDismiss(comment.id)}
                          className="text-xs border border-slate-300 hover:bg-slate-50 text-slate-600 rounded px-2 py-1 transition-colors">Dismiss</button>
                      )}
                      <button onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs text-red-500 hover:text-red-700 rounded px-2 py-1 transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating button */}
      {floatingBtn && (
        <div data-float-btn className="fixed z-50 -translate-x-1/2 pointer-events-auto" style={{ left: floatingBtn.x, top: floatingBtn.y }}>
          <button onPointerDown={(e) => { e.preventDefault(); handleAddComment(); }}
            className="bg-slate-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg font-medium hover:bg-slate-700 transition-colors whitespace-nowrap touch-manipulation">
            + Add Comment
          </button>
        </div>
      )}

      {/* Add Experience modal */}
      {addExpOpen && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg flex flex-col max-h-[90vh]">
            <h3 className="font-semibold text-slate-900 mb-3">Add Experience to Resume</h3>
            {addExpLoading ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="overflow-y-auto flex-1 mb-3 space-y-2 max-h-64">
                {allExperiences.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No experiences found.</p>}
                {allExperiences.map((exp) => {
                  const alreadyIn = experienceIdsInResume.has(exp.id);
                  const isSelected = selectedExpId === exp.id;
                  return (
                    <button key={exp.id} disabled={alreadyIn || addExpStreaming} onClick={() => setSelectedExpId(exp.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        alreadyIn ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                        : isSelected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div><span className="font-medium text-slate-900">{exp.title}</span><span className="text-slate-500"> at {exp.company}</span></div>
                        {alreadyIn ? <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Already included</span>
                          : <span className="shrink-0 text-xs text-slate-400">{formatDate(exp.startDate)} – {exp.isCurrent ? "Present" : formatDate(exp.endDate)}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <textarea value={addExpNotes} onChange={(e) => setAddExpNotes(e.target.value)} rows={2} disabled={addExpStreaming}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50 mb-3"
              placeholder="What to emphasize? (optional)" />
            {addExpStreamText && <div className="mb-3 p-3 bg-slate-50 rounded-lg max-h-24 overflow-y-auto"><p className="text-xs text-slate-500 mb-1 font-medium">Adding...</p><pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{addExpStreamText}</pre></div>}
            {addExpError && <p className="mb-3 text-xs text-red-600 bg-red-50 rounded p-2">{addExpError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setAddExpOpen(false)} disabled={addExpStreaming}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleAddExp} disabled={!selectedExpId || addExpStreaming}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
                {addExpStreaming ? "Adding..." : "Add to Resume"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate modal */}
      {regenOpen && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold text-slate-900 mb-1">Regenerate Resume</h3>
            {(jobTitle || companyName) && <p className="text-xs text-slate-500 mb-3">Target: <strong>{jobTitle}</strong>{jobTitle && companyName ? " at " : ""}<strong>{companyName}</strong></p>}
            <textarea autoFocus value={regenInstructions} onChange={(e) => setRegenInstructions(e.target.value)} rows={4} disabled={regenStreaming}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              placeholder="Custom instructions (optional)" />
            {regenStreamText && <div className="mt-3 p-3 bg-slate-50 rounded-lg max-h-32 overflow-y-auto"><p className="text-xs text-slate-500 mb-1 font-medium">Generating...</p><pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">{regenStreamText}</pre></div>}
            {regenError && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{regenError}</p>}
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setRegenOpen(false)} disabled={regenStreaming}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleRegen} disabled={regenStreaming}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
                {regenStreaming ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment popover */}
      {commentPopover && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-1 text-sm">Add Comment</h3>
            <p className="text-xs text-slate-500 mb-3 italic">On: &ldquo;{commentPopover.selectedText.substring(0, 60)}{commentPopover.selectedText.length > 60 ? "..." : ""}&rdquo;</p>
            <textarea autoFocus value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What would you like to change or improve?"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveComment(); }} />
            <p className="text-xs text-slate-400 mt-1 mb-3">Cmd+Enter to save</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setCommentPopover(null); setCommentBody(""); }}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm transition-colors">Cancel</button>
              <button onClick={handleSaveComment} disabled={savingComment || !commentBody.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors">
                {savingComment ? "Saving..." : "Save Comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fit to Page modal */}
      {fitToPageOpen && (
        <FitToPage
          content={content}
          accessToken={accessToken!}
          onApply={async (updated) => {
            await updateResume(resumeId, { content: updated });
            setContent(updated);
            setFitToPageOpen(false);
          }}
          onClose={() => setFitToPageOpen(false)}
        />
      )}

      {/* Hidden A4 measurement container */}
      <div className="fixed left-[-9999px] top-0" aria-hidden>
        <div ref={printMeasureRef} className="w-[794px] bg-white px-[60px] py-[48px]" style={{ fontFamily: "var(--font-sans)" }}>
          <MeasurePreview content={content} />
        </div>
      </div>
    </div>
  );
}

/** Minimal print-style rendering for measuring overflow height */
function MeasurePreview({ content }: { content: ResumeContent }) {
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
        <div className="mb-4"><h2 className="text-[10px] font-bold uppercase tracking-widest mb-1.5">Summary</h2>
          <p className="text-[11.5px] leading-relaxed">{summary}</p></div>
      )}
      {experience.length > 0 && (
        <div className="mb-4"><h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Experience</h2>
          <div className="space-y-3.5">{experience.map((exp, i) => (
            <div key={i}><div className="flex justify-between"><div>
              <p className="text-[12px] font-semibold">{exp.title}</p>
              <p className="text-[11px]">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</p>
            </div><p className="text-[10.5px] shrink-0 ml-3">{exp.startDate} — {exp.endDate ?? "Present"}</p></div>
            {exp.bullets.length > 0 && <ul className="mt-1 space-y-0.5 pl-1">{exp.bullets.map((b, bi) => (
              <li key={bi} className="flex gap-2 text-[11px] leading-snug"><span className="shrink-0 mt-0.5">•</span><span>{b}</span></li>
            ))}</ul>}</div>
          ))}</div></div>
      )}
      {education.length > 0 && (
        <div className="mb-4"><h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Education</h2>
          {education.map((edu, i) => (
            <div key={i} className="flex justify-between mb-1"><div>
              <p className="text-[12px] font-semibold">{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</p>
              <p className="text-[11px]">{edu.institution}</p>
            </div><p className="text-[10.5px] shrink-0 ml-3">{edu.graduationDate}</p></div>
          ))}</div>
      )}
      {skills.length > 0 && (
        <div className="mb-4"><h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Skills</h2>
          {skills.map((g, i) => (
            <div key={i} className="flex gap-2 text-[11px]"><span className="font-semibold shrink-0 w-[130px]">{g.category}:</span><span>{g.skills.join(", ")}</span></div>
          ))}</div>
      )}
      {certifications && certifications.length > 0 && (
        <div className="mb-4"><h2 className="text-[10px] font-bold uppercase tracking-widest mb-2">Certifications</h2>
          {certifications.map((c, i) => (<div key={i} className="text-[11px]"><span className="font-medium">{c.name}</span> · {c.issuer}</div>))}</div>
      )}
    </>
  );
}
