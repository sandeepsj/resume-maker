import type { ResumeContent } from "@/types/resume";
import type { ExperienceData } from "@/types/career";

export const ADD_EXPERIENCE_SYSTEM_PROMPT = `You are editing a professional resume to incorporate a new work experience entry.

Rules:
- Insert the new experience in chronological order (most recent first) within the experience array.
- Write 3–5 bullet points using strong past-tense action verbs, drawing only from the provided role summary and tasks.
- Quantify impact with concrete numbers in each bullet, and wrap the most relevant keywords/technologies/metrics in Markdown **bold** — matching the style of the existing experience entries.
- Do not modify any other section of the resume (summary, education, skills, etc.).
- Return ONLY valid JSON — no markdown, no explanation outside the JSON structure.`;

export function buildAddExperiencePrompt(params: {
  resumeContent: ResumeContent;
  experience: ExperienceData;
  notes?: string;
}): string {
  const { resumeContent, experience, notes } = params;

  const tasksText =
    experience.tasks.length > 0
      ? experience.tasks
          .map((t) => {
            const details = t.details ? `: ${t.details}` : "";
            const skills = t.skills?.length ? ` [skills: ${t.skills.join(", ")}]` : "";
            return `  - ${t.title}${details}${skills}`;
          })
          .join("\n")
      : "  (none provided)";

  return `CURRENT RESUME JSON:
${JSON.stringify(resumeContent, null, 2)}

EXPERIENCE TO ADD:
Title: ${experience.title}
Company: ${experience.company}${experience.location ? `\nLocation: ${experience.location}` : ""}
Dates: ${experience.startDate} – ${experience.isCurrent ? "Present" : experience.endDate ?? "Present"}
Role summary: ${experience.description}
Tasks worked on:
${tasksText}
${
    notes
      ? `
USER NOTES:
${notes}
`
      : ""
  }
Return a JSON object with EXACTLY this structure:
{
  "updatedResume": { ...complete updated ResumeContent JSON with the new experience inserted... },
  "explanation": "string (1-2 sentences describing what was added)"
}

Add the experience to the resume now:`;
}
