import type { ResumeContent } from "@/types/resume";

export const APPLY_COMMENT_SYSTEM_PROMPT = `You are editing a specific section of a professional resume based on a user's change request.

Your task is to make ONLY the requested change, leaving all other sections exactly as they are.

Rules:
- Make surgical, minimal edits. Only change what the user explicitly requested.
- Preserve the existing tone, style, and structure of the rest of the resume.
- Keep bullet points in action-verb format (Led, Built, Designed, etc.).
- Do not add information not present in the original resume.
- Do not change any other section besides the one indicated.
- Return ONLY valid JSON — no markdown, no explanation outside the JSON structure.`;

export function buildApplyCommentPrompt(params: {
  resumeContent: ResumeContent;
  sectionKey: string;
  selectedText: string;
  commentBody: string;
}): string {
  const { resumeContent, sectionKey, selectedText, commentBody } = params;

  return `CURRENT RESUME JSON:
${JSON.stringify(resumeContent, null, 2)}

EDIT REQUEST:
- Section path: ${sectionKey}
  (Format: "summary" | "experience.{index}.bullets.{index}" | "experience.{index}.title" | etc.)
- Selected text: "${selectedText}"
- User's change request: "${commentBody}"

Return a JSON object with EXACTLY this structure:
{
  "updatedResume": { ...complete updated ResumeContent JSON... },
  "explanation": "string (1-2 sentences describing what was changed)"
}

Apply the requested change now:`;
}
