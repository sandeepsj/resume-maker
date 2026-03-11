export interface ResumeHeader {
  name: string;
  headline: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface ResumeExperience {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  graduationDate: string;
  gpa?: string;
  honors?: string;
}

export interface ResumeSkillGroup {
  category: string;
  skills: string[];
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  date?: string;
}

export interface ResumeProject {
  name: string;
  description: string;
  url?: string;
  technologies: string[];
}

export interface ResumeContent {
  header: ResumeHeader;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: ResumeSkillGroup[];
  certifications?: ResumeCertification[];
  projects?: ResumeProject[];
}
