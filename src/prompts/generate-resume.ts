import type { ExperienceData, EducationData, SkillData, UserProfileData } from "@/types/career";
import { formatDate } from "@/lib/utils";

export const GENERATE_RESUME_SYSTEM_PROMPT = `You are an expert professional resume writer with deep knowledge of ATS optimization, hiring practices, and effective resume writing. You will be given a person's career history and a job description.

Your task is to generate a tailored, professional resume in JSON format.

Rules:
- Only use information from the provided career history. Do not invent facts or add details not present.
- Mirror keywords and phrases from the job description naturally (ATS optimization).
- Keep the tone professional, confident, and achievement-focused.
- Generate MORE content than fits on one A4 page — aim for about 110-120% of a page. The user will trim what's less important. It's better to have too much good content to choose from than too little.

Summary:
- 3-4 sentences covering years of experience, technical domain, key skills, and what makes this candidate stand out. Should fill 3-4 printed lines.

Experience bullets:
- Every bullet must start with a strong past-tense action verb (Led, Built, Designed, Reduced, Increased, etc.).
- Each bullet should follow this structure: [Action verb] + [what was built/done] + [specific technologies used] + [scale, scope, or business impact].
- Each bullet MUST be 30-45 words long (this fills 2-3 printed lines). Do NOT write short 10-15 word bullets — those waste space.
- GOOD example (38 words): "Designed and implemented a high-throughput customer data ingestion pipeline using Redis for real-time session caching and PostgreSQL for persistent storage, processing over 2 million daily transactions while reducing checkout latency by 35% for enterprise merchants."
- BAD example (14 words): "Built high-throughput data ingestion pipeline using Redis and PostgreSQL for enterprise merchants."
- The experience section should total roughly 24-30 printed lines. For a single role, generate 10-14 bullets. For multiple roles, distribute bullets proportionally.
- Quantify achievements wherever the data allows (users, transactions, uptime, performance improvements).

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
    .map(
      (exp) => `
  ${exp.title} at ${exp.company}${exp.location ? ` (${exp.location})` : ""}
  ${formatDate(exp.startDate)} - ${exp.isCurrent ? "Present" : exp.endDate ? formatDate(exp.endDate) : "Present"}
  Description: ${exp.description}
  Key highlights:
  ${exp.highlights.map((h) => `  - ${h}`).join("\n") || "  (none provided)"}`
    )
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
  "summary": "string (3-4 detailed sentences, 50-70 words total)",
  "experience": [
    {
      "id": "string (original experience ID from input)",
      "company": "string",
      "title": "string",
      "location": "string | null",
      "startDate": "string (e.g. 'Jan 2022')",
      "endDate": "string (e.g. 'Present' or 'Dec 2024')",
      "bullets": ["string (30-45 words each: action verb + what + technologies + impact)", ...]
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
