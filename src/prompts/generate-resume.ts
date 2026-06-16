import type { ExperienceData, EducationData, SkillData, UserProfileData } from "@/types/career";
import { formatDate } from "@/lib/utils";

export const GENERATE_RESUME_SYSTEM_PROMPT = `You are an expert professional resume writer with deep knowledge of ATS optimization, hiring practices, and effective resume writing. You will be given a person's career history and a job description.

Your task is to generate a tailored, professional resume in JSON format.

Rules:
- Only use information from the provided career history. Do not invent facts or add details not present.
- Mirror keywords and phrases from the job description naturally (ATS optimization).
- Keep the tone professional, confident, and achievement-focused.
- Generate MORE content than fits on one A4 page — aim for about 110-120% of a page. The user will trim what's less important. It's better to have too much good content to choose from than too little.

Relevance (strict — this matters most):
- Tailor everything to the TARGET JOB. Only include experience, responsibilities, and bullets that demonstrate value for THIS role.
- OMIT entirely any experience, project, or bullet that does not strengthen the candidate for this specific job. Do not pad with unrelated work just because it exists in the career history — irrelevant content weakens the resume and wastes a recruiter's attention.
- If an entire past role is unrelated to the target job, you may drop it or compress it to a single high-level bullet rather than detailing it.
- Prioritize the skills, technologies, and domains the job description explicitly asks for.
- Base each role's experience bullets ONLY on the specific tasks listed for that role (these are the tasks the user selected to include) plus its role summary. Do not invent work beyond the provided tasks.

Bolding important keywords (use Markdown **double asterisks**):
- Wrap the keywords, technologies, and metrics that are most relevant to the JOB DESCRIPTION in **bold** so a recruiter's eye lands on them. Example: "...using **Redis** for caching, reducing latency by **35%**...".
- Bold the specific terms only (a tool name, a metric, a key skill) — NEVER bold whole sentences or clauses. Aim for roughly 2-4 bolded fragments per bullet.
- Apply the same bolding inside the summary for the 2-3 most important differentiators.
- Only bold terms that genuinely appear in or map to the job description's requirements.

Summary:
- 3-4 sentences covering years of experience, technical domain, key skills, and what makes this candidate stand out. Should fill 3-4 printed lines.

Experience bullets:
- Every bullet must start with a strong past-tense action verb (Led, Built, Designed, Reduced, Increased, etc.).
- Each bullet should follow this structure: [Action verb] + [what was built/done] + [specific technologies used] + [quantified impact with a number].
- QUANTIFY THE IMPACT WITH NUMBERS. Every bullet must show measurable impact using concrete figures — percentages, counts, time saved, revenue, users, latency, scale (e.g. "by 35%", "2M daily transactions", "from 4h to 8min", "for 50+ enterprise clients"). If the career history lacks an exact number, give a reasonable, defensible estimate grounded in the described work rather than a vague claim. Never write a bullet with no number in it.
- Each bullet MUST be 30-45 words long (this fills 2-3 printed lines). Do NOT write short 10-15 word bullets — those waste space.
- GOOD example (38 words): "Designed and implemented a high-throughput customer data ingestion pipeline using **Redis** for real-time session caching and **PostgreSQL** for persistent storage, processing over **2 million daily transactions** while reducing checkout latency by **35%** for enterprise merchants."
- BAD example (14 words, no metrics, nothing bold): "Built high-throughput data ingestion pipeline using Redis and PostgreSQL for enterprise merchants."
- The experience section should total roughly 20-24 printed lines (15 words per line). For a single role, generate 8-10 bullets. For multiple roles, distribute bullets proportionally.

Skills:
- Group logically by category. Use short category names (e.g. "Languages:", "Frameworks:", "Tools:", "Databases:").
- Return ONLY valid JSON matching the schema provided. No markdown fences, no explanation text, no preamble.`;

export function buildGenerateResumePrompt(params: {
  profile: UserProfileData;
  userEmail: string;
  userName: string;
  experiences: ExperienceData[];
  educations: EducationData[];
  skills: SkillData[];
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  customInstructions?: string;
}): string {
  const {
    profile,
    userEmail,
    userName,
    experiences,
    educations,
    skills,
    jobTitle,
    companyName,
    jobDescription,
    customInstructions,
  } = params;

  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) acc[skill.category] = [];
      acc[skill.category].push(skill.name);
      return acc;
    },
    {} as Record<string, string[]>
  );

  const experienceText = experiences
    .map((exp) => {
      const tasksText = exp.tasks.length
        ? exp.tasks
            .map((t) => {
              const details = t.details ? `: ${t.details}` : "";
              const skills = t.skills?.length ? ` [skills: ${t.skills.join(", ")}]` : "";
              return `    - ${t.title}${details}${skills}`;
            })
            .join("\n")
        : "    (no specific tasks selected — base bullets on the role summary)";
      return `
  ${exp.title} at ${exp.company}${exp.location ? ` (${exp.location})` : ""}
  ${formatDate(exp.startDate)} - ${exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "Present"}
  Role summary: ${exp.description}
  Selected tasks for this role (base the experience bullets ONLY on these):
${tasksText}`;
    })
    .join("\n\n");

  const educationText = educations
    .map(
      (edu) => `
  ${edu.degree}${edu.field ? ` in ${edu.field}` : ""}, ${edu.institution}
  Graduated: ${edu.endDate ? formatDate(edu.endDate) : "In Progress"}
  ${edu.gpa ? `GPA: ${edu.gpa}` : ""}${edu.honors ? `, Honors: ${edu.honors}` : ""}`
    )
    .join("\n");

  const skillsText = Object.entries(skillsByCategory)
    .map(([cat, names]) => `  ${cat}: ${names.join(", ")}`)
    .join("\n");

  return `CAREER PROFILE:
Name: ${userName}
Email: ${userEmail}
${profile.headline ? `Headline: ${profile.headline}` : ""}
${profile.phone ? `Phone: ${profile.phone}` : ""}
${profile.location ? `Location: ${profile.location}` : ""}
${profile.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}` : ""}
${profile.githubUrl ? `GitHub: ${profile.githubUrl}` : ""}
${profile.portfolioUrl ? `Portfolio: ${profile.portfolioUrl}` : ""}
${profile.summary ? `Raw Professional Summary: ${profile.summary}` : ""}

WORK EXPERIENCE (most recent first):
${experienceText}

EDUCATION:
${educationText}

SKILLS:
${skillsText}

TARGET JOB:
Title: ${jobTitle}
Company: ${companyName}
Job Description:
${jobDescription}

OUTPUT SCHEMA — return a JSON object with EXACTLY this structure:
{
  "header": {
    "name": "string",
    "headline": "string (tailored to the role)",
    "email": "string",
    "phone": "string | null",
    "location": "string | null",
    "linkedinUrl": "string | null",
    "githubUrl": "string | null",
    "portfolioUrl": "string | null"
  },
  "summary": "string (3-4 detailed sentences, 50-70 words total; **bold** the 2-3 most job-relevant differentiators)",
  "experience": [
    {
      "id": "string (original experience ID from input)",
      "company": "string",
      "title": "string",
      "location": "string | null",
      "startDate": "string (e.g. 'Jan 2022')",
      "endDate": "string (e.g. 'Present' or 'Dec 2024')",
      "bullets": ["string (30-45 words each: action verb + what + technologies + quantified impact with a number; **bold** the most job-relevant keywords/technologies/metrics)", ...]
    }
  ],
  "education": [
    {
      "id": "string (original education ID)",
      "institution": "string",
      "degree": "string",
      "field": "string | null",
      "graduationDate": "string (e.g. 'May 2020')",
      "gpa": "string | null",
      "honors": "string | null"
    }
  ],
  "skills": [
    {
      "category": "string (e.g. 'Languages', 'Frameworks', 'Tools')",
      "skills": ["string", ...]
    }
  ]
}

Generate the tailored resume now:${
    customInstructions
      ? `

ADDITIONAL INSTRUCTIONS FROM USER:
${customInstructions}
These take priority — incorporate them carefully without inventing new facts.`
      : ""
  }`;
}
