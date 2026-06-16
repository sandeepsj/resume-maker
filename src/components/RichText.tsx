import { Fragment } from "react";

/**
 * Renders a string with Markdown-style **bold** segments as <strong>.
 * Used for resume bullets and summary so AI-emphasised, job-relevant keywords
 * stand out. Everything else renders as plain text (React escapes it safely).
 */
export function RichText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

/** Strip **bold** markers, e.g. for plain-text contexts like ATS analysis. */
export function stripRichText(text: string): string {
  return text.replace(/\*\*/g, "");
}
