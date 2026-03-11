export type SkillCategory =
  | "TECHNICAL"
  | "LANGUAGE"
  | "SOFT"
  | "TOOL"
  | "FRAMEWORK"
  | "CERTIFICATION";

export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface UserProfileData {
  id: string;
  headline?: string | null;
  summary?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
}

export interface ExperienceData {
  id: string;
  company: string;
  title: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  description: string;
  highlights: string[];
}

export interface EducationData {
  id: string;
  institution: string;
  degree: string;
  field?: string | null;
  startDate: string;
  endDate?: string | null;
  gpa?: string | null;
  honors?: string | null;
  activities: string[];
}

export interface SkillData {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
}
