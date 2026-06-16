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

/** A discrete piece of work within an experience (Phase 1). */
export interface ExperienceTask {
  id: string;
  title: string;            // short label of the task/accomplishment
  details?: string;         // optional longer description / impact
  skills?: string[];        // technologies/skills used — aids matching + keyword bolding
  isDefault?: boolean;      // included by default when building a new resume (Phase 2)
}

export interface ExperienceData {
  id: string;
  company: string;
  title: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  description: string;      // summary of the overall role
  /**
   * Legacy flat highlights. Only read to migrate old Drive records into `tasks`
   * (see `normalizeExperience`); cleared to `[]` whenever an experience is saved.
   * Superseded by `tasks` — do not write new data here.
   */
  highlights: string[];
  /** Discrete tasks within this role. Synthesized from `highlights` for legacy data. */
  tasks: ExperienceTask[];
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
