"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import type { ResumeContent } from "@/types/resume";

interface CommentData {
  id: string;
  sectionKey: string;
  selectedText: string;
  anchorOffset: number;
  focusOffset: number;
  body: string;
  status: string;
  aiResponse?: string | null;
  createdAt: string;
}

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
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Present";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  APPLIED: "bg-green-100 text-green-700",
  DISMISSED: "bg-slate-100 text-slate-500",
};

export default function ResumeViewer({
  resumeId,
  content,
  resumeTitle,
  initialComments,
}: ResumeViewerProps) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const [floatingBtn, setFloatingBtn] = useState<FloatingButton | null>(null);
  const [commentPopover, setCommentPopover] = useState<{
    sectionKey: string;
    selectedText: string;
    anchorOffset: number;
    focusOffset: number;
  } | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [applyingCommentId, setApplyingCommentId] = useState<string | null>(null);
  const [applyStreamText, setApplyStreamText] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const resumeRef = useRef<HTMLDivElement>(null);

  // Reload after apply-comment completes
  const reloadPage = useCallback(() => {
    window.location.reload();
  }, []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setFloatingBtn(null);
      return;
    }

    const selectedText = sel.toString().trim();
    const range = sel.getRangeAt(0);

    // Check if selection is within the resume container
    if (!resumeRef.current?.contains(range.commonAncestorContainer)) {
      setFloatingBtn(null);
      return;
    }

    // Walk up to find the section element with data-section-key
    let node: Node | null = range.commonAncestorContainer;
    let sectionKey = "";
    while (node && node !== resumeRef.current) {
      if (node instanceof Element) {
        const key = node.getAttribute("data-section-key");
        if (key) {
          sectionKey = key;
          break;
        }
      }
      node = node.parentNode;
    }

    if (!sectionKey) {
      setFloatingBtn(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setFloatingBtn({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      sectionKey,
      selectedText,
      anchorOffset: range.startOffset,
      focusOffset: range.endOffset,
    });
  }, []);

  const handleAddComment = () => {
    if (!floatingBtn) return;
    setCommentPopover({
      sectionKey: floatingBtn.sectionKey,
      selectedText: floatingBtn.selectedText,
      anchorOffset: floatingBtn.anchorOffset,
      focusOffset: floatingBtn.focusOffset,
    });
    setFloatingBtn(null);
    setCommentBody("");
    window.getSelection()?.removeAllRanges();
  };

  const handleSaveComment = async () => {
    if (!commentPopover || !commentBody.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionKey: commentPopover.sectionKey,
          selectedText: commentPopover.selectedText,
          anchorOffset: commentPopover.anchorOffset,
          focusOffset: commentPopover.focusOffset,
          body: commentBody.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save comment");
      const created = await res.json();
      const newComment: CommentData = {
        id: created._id,
        sectionKey: created.sectionKey,
        selectedText: created.selectedText,
        anchorOffset: created.anchorOffset,
        focusOffset: created.focusOffset,
        body: created.body,
        status: created.status,
        aiResponse: created.aiResponse ?? null,
        createdAt: created.createdAt,
      };
      setComments((prev) => [newComment, ...prev]);
      setCommentPopover(null);
      setCommentBody("");
      setSidebarOpen(true);
    } catch {
      alert("Failed to save comment. Please try again.");
    } finally {
      setSavingComment(false);
    }
  };

  const handleDismiss = async (commentId: string) => {
    try {
      const res = await fetch(`/api/resumes/${resumeId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      if (!res.ok) throw new Error();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, status: "DISMISSED" } : c))
      );
    } catch {
      alert("Failed to dismiss comment.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/resumes/${resumeId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      alert("Failed to delete comment.");
    }
  };

  const handleApplyAiEdit = async (commentId: string) => {
    setApplyingCommentId(commentId);
    setApplyStreamText((prev) => ({ ...prev, [commentId]: "" }));

    try {
      const res = await fetch("/api/ai/apply-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, commentId }),
      });

      if (!res.ok) throw new Error("Failed to apply edit");

      const reader = res.body!.getReader();
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
              setApplyStreamText((prev) => ({ ...prev, [commentId]: (prev[commentId] ?? "") + json.text }));
            } else if (json.type === "done") {
              reloadPage();
              return;
            } else if (json.type === "error") {
              alert("AI edit failed: " + json.error);
              setApplyingCommentId(null);
              return;
            }
          } catch {
            // skip partial lines
          }
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply edit");
    } finally {
      setApplyingCommentId(null);
    }
  };

  // Close floating button on click-away
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (floatingBtn && !(e.target as Element)?.closest("[data-float-btn]")) {
        setFloatingBtn(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [floatingBtn]);

  const { header, summary, experience, education, skills, certifications } = content;
  const activeComments = comments.filter((c) => c.status !== "DISMISSED");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/resumes"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Back to Resumes
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{resumeTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            {sidebarOpen ? "Hide" : "Show"} Comments ({activeComments.length})
          </button>
          <button
            onClick={() => alert("PDF export coming soon")}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Resume content */}
        <div className={`flex-1 overflow-auto p-8 ${sidebarOpen ? "mr-80" : ""}`}>
          <div
            ref={resumeRef}
            className="max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-xl p-10 select-text"
            onMouseUp={handleMouseUp}
          >
            {/* Header */}
            <div data-section-key="header" className="mb-6 pb-6 border-b border-slate-200">
              <h1 className="text-3xl font-bold text-slate-900">{header.name}</h1>
              {header.headline && (
                <p className="text-lg text-slate-600 mt-1">{header.headline}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-500">
                <span>{header.email}</span>
                {header.phone && <span>{header.phone}</span>}
                {header.location && <span>{header.location}</span>}
                {header.linkedinUrl && (
                  <a
                    href={header.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    LinkedIn
                  </a>
                )}
                {header.githubUrl && (
                  <a
                    href={header.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    GitHub
                  </a>
                )}
                {header.portfolioUrl && (
                  <a
                    href={header.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Portfolio
                  </a>
                )}
              </div>
            </div>

            {/* Summary */}
            {summary && (
              <div data-section-key="summary" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Summary
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Experience */}
            {experience.length > 0 && (
              <div data-section-key="experience" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Experience
                </h2>
                <div className="space-y-5">
                  {experience.map((exp, i) => (
                    <div key={exp.id ?? i} data-section-key={`experience-${exp.id ?? i}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm">
                            {exp.title}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {exp.company}
                            {exp.location && ` · ${exp.location}`}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 shrink-0 ml-4">
                          {formatDate(exp.startDate)} — {formatDate(exp.endDate)}
                        </p>
                      </div>
                      {exp.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {exp.bullets.map((bullet, bi) => (
                            <li key={bi} className="flex gap-2 text-sm text-slate-700">
                              <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                              <span>{bullet}</span>
                            </li>
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
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Education
                </h2>
                <div className="space-y-4">
                  {education.map((edu, i) => (
                    <div key={edu.id ?? i} data-section-key={`education-${edu.id ?? i}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm">
                            {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                          </h3>
                          <p className="text-sm text-slate-600">{edu.institution}</p>
                          {(edu.gpa || edu.honors) && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {[edu.gpa && `GPA: ${edu.gpa}`, edu.honors]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 shrink-0 ml-4">
                          {formatDate(edu.graduationDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <div data-section-key="skills" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Skills
                </h2>
                <div className="space-y-1.5">
                  {skills.map((group, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-medium text-slate-700 shrink-0 w-32">
                        {group.category}:
                      </span>
                      <span className="text-slate-600">{group.skills.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {certifications && certifications.length > 0 && (
              <div data-section-key="certifications" className="mb-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Certifications
                </h2>
                <div className="space-y-1.5">
                  {certifications.map((cert, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-slate-900">{cert.name}</span>
                        <span className="text-slate-500"> · {cert.issuer}</span>
                      </div>
                      {cert.date && (
                        <span className="text-xs text-slate-400">{cert.date}</span>
                      )}
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
              <h2 className="font-semibold text-slate-900 text-sm">
                Comments ({activeComments.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select text in the resume to add a comment.
              </p>
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
                      <p className="text-xs text-slate-500 italic line-clamp-2">
                        &ldquo;{comment.selectedText}&rdquo;
                      </p>
                      <span
                        className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[comment.status] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {comment.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-1">{comment.body}</p>
                    {comment.aiResponse && (
                      <p className="text-xs text-green-700 bg-green-50 rounded p-2 mt-2">
                        {comment.aiResponse}
                      </p>
                    )}
                    {applyingCommentId === comment.id && applyStreamText[comment.id] && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 max-h-20 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-mono">{applyStreamText[comment.id]}</pre>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      {comment.status === "PENDING" && (
                        <button
                          onClick={() => handleApplyAiEdit(comment.id)}
                          disabled={applyingCommentId === comment.id}
                          className="text-xs bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-1 font-medium disabled:opacity-50 transition-colors"
                        >
                          {applyingCommentId === comment.id ? "Applying..." : "Apply AI Edit"}
                        </button>
                      )}
                      {comment.status === "PENDING" && (
                        <button
                          onClick={() => handleDismiss(comment.id)}
                          className="text-xs border border-slate-300 hover:bg-slate-50 text-slate-600 rounded px-2 py-1 transition-colors"
                        >
                          Dismiss
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs text-red-500 hover:text-red-700 rounded px-2 py-1 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating "Add Comment" button */}
      {floatingBtn && (
        <div
          data-float-btn
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full pointer-events-auto"
          style={{ left: floatingBtn.x, top: floatingBtn.y }}
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleAddComment();
            }}
            className="bg-slate-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            + Add Comment
          </button>
        </div>
      )}

      {/* Comment popover */}
      {commentPopover && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-1 text-sm">Add Comment</h3>
            <p className="text-xs text-slate-500 mb-3 italic">
              On: &ldquo;{commentPopover.selectedText.substring(0, 60)}
              {commentPopover.selectedText.length > 60 ? "..." : ""}&rdquo;
            </p>
            <textarea
              autoFocus
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What would you like to change or improve?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSaveComment();
                }
              }}
            />
            <p className="text-xs text-slate-400 mt-1 mb-3">Cmd+Enter to save</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setCommentPopover(null);
                  setCommentBody("");
                }}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComment}
                disabled={savingComment || !commentBody.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {savingComment ? "Saving..." : "Save Comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
