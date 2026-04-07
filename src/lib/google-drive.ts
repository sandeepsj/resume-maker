/**
 * Google Drive service layer — replaces all MongoDB operations.
 *
 * Folder structure in user's Drive:
 *   Resume Maker/
 *     profile.json
 *     career/
 *       experiences.json
 *       education.json
 *       skills.json
 *     resumes/
 *       {uuid}/
 *         resume.json   ← metadata + content + comments
 */

import type { ResumeContent } from "@/types/resume";
import type {
  UserProfileData,
  ExperienceData,
  EducationData,
  SkillData,
} from "@/types/career";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResumeStatus = "DRAFT" | "GENERATING" | "READY" | "EXPORTED";

export interface CommentData {
  id: string;
  sectionKey: string;
  selectedText: string;
  anchorOffset: number;
  focusOffset: number;
  body: string;
  status: "PENDING" | "PROCESSING" | "APPLIED" | "DISMISSED";
  aiResponse?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveResumeFile {
  id: string;
  title: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  content?: ResumeContent;
  status: ResumeStatus;
  aiModel?: string;
  comments: CommentData[];
  createdAt: string;
  updatedAt: string;
}

/** Lightweight resume metadata for listing (no content/comments). */
export interface ResumeListItem {
  id: string;
  title: string;
  jobTitle?: string;
  companyName?: string;
  status: ResumeStatus;
  createdAt: string;
  updatedAt: string;
  driveFileId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const APP_FOLDER_NAME = "Resume Maker";

// ---------------------------------------------------------------------------
// In-memory cache for folder IDs (avoids repeated lookups)
// ---------------------------------------------------------------------------

const folderCache = new Map<string, string>();

function clearCache() {
  folderCache.clear();
}

// ---------------------------------------------------------------------------
// Token access — set by the app when auth state changes
// ---------------------------------------------------------------------------

let _getToken: () => string | null = () => null;

export function setTokenAccessor(fn: () => string | null) {
  _getToken = fn;
}

function getToken(): string {
  const token = _getToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

// ---------------------------------------------------------------------------
// Generic Drive helpers
// ---------------------------------------------------------------------------

async function driveQuery(q: string, fields = "files(id,name,modifiedTime,appProperties)"): Promise<Array<{ id: string; name: string; modifiedTime?: string; appProperties?: Record<string, string> }>> {
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&spaces=drive`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Drive query failed: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

async function findFileByName(parentId: string, name: string): Promise<string | null> {
  const q = `'${parentId}' in parents and name='${name}' and trashed=false`;
  const files = await driveQuery(q, "files(id)");
  return files[0]?.id ?? null;
}

async function getOrCreateFolder(parentId: string | null, name: string): Promise<string> {
  const cacheKey = `${parentId ?? "root"}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const parentClause = parentId ? `'${parentId}' in parents and ` : "";
  const q = `${parentClause}name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const files = await driveQuery(q, "files(id)");

  if (files[0]) {
    folderCache.set(cacheKey, files[0].id);
    return files[0].id;
  }

  // Create the folder
  const body: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) body.parents = [parentId];

  const res = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`);
  const created = await res.json();
  folderCache.set(cacheKey, created.id);
  return created.id;
}

async function readJsonFile<T>(fileId: string): Promise<T> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
  return res.json();
}

async function createJsonFile<T>(
  parentId: string,
  name: string,
  data: T,
  appProperties?: Record<string, string>
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    parents: [parentId],
    mimeType: "application/json",
  };
  if (appProperties) metadata.appProperties = appProperties;

  const boundary = "---boundary" + Date.now();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(data)}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: headers({ "Content-Type": `multipart/related; boundary=${boundary}` }),
    body,
  });
  if (!res.ok) throw new Error(`Failed to create file: ${res.status}`);
  const result = await res.json();
  return result.id;
}

async function updateJsonFile<T>(
  fileId: string,
  data: T,
  appProperties?: Record<string, string>
): Promise<void> {
  // If we have appProperties to update, do a metadata PATCH first
  if (appProperties) {
    await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ appProperties }),
    });
  }

  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json; charset=UTF-8" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update file: ${res.status}`);
}

async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete: ${res.status}`);
}

// ---------------------------------------------------------------------------
// App folder structure
// ---------------------------------------------------------------------------

async function getAppFolderId(): Promise<string> {
  return getOrCreateFolder(null, APP_FOLDER_NAME);
}

async function getCareerFolderId(): Promise<string> {
  const appId = await getAppFolderId();
  return getOrCreateFolder(appId, "career");
}

async function getResumesFolderId(): Promise<string> {
  const appId = await getAppFolderId();
  return getOrCreateFolder(appId, "resumes");
}

// ---------------------------------------------------------------------------
// Helper: read or create a JSON file with default value
// ---------------------------------------------------------------------------

async function readOrCreate<T>(parentId: string, name: string, defaultValue: T): Promise<{ fileId: string; data: T }> {
  const fileId = await findFileByName(parentId, name);
  if (fileId) {
    const data = await readJsonFile<T>(fileId);
    return { fileId, data };
  }
  const newId = await createJsonFile(parentId, name, defaultValue);
  return { fileId: newId, data: defaultValue };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<UserProfileData> {
  const appId = await getAppFolderId();
  const { data } = await readOrCreate<UserProfileData>(appId, "profile.json", {
    id: "profile",
    headline: null,
    summary: null,
    phone: null,
    location: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
  });
  return data;
}

export async function saveProfile(profile: UserProfileData): Promise<void> {
  const appId = await getAppFolderId();
  const fileId = await findFileByName(appId, "profile.json");
  if (fileId) {
    await updateJsonFile(fileId, profile);
  } else {
    await createJsonFile(appId, "profile.json", profile);
  }
}

// ---------------------------------------------------------------------------
// Career: Experiences
// ---------------------------------------------------------------------------

export async function getExperiences(): Promise<ExperienceData[]> {
  const careerId = await getCareerFolderId();
  const { data } = await readOrCreate<ExperienceData[]>(careerId, "experiences.json", []);
  return data;
}

export async function saveExperiences(experiences: ExperienceData[]): Promise<void> {
  const careerId = await getCareerFolderId();
  const fileId = await findFileByName(careerId, "experiences.json");
  if (fileId) {
    await updateJsonFile(fileId, experiences);
  } else {
    await createJsonFile(careerId, "experiences.json", experiences);
  }
}

export async function addExperience(exp: Omit<ExperienceData, "id">): Promise<ExperienceData> {
  const experiences = await getExperiences();
  const newExp: ExperienceData = { ...exp, id: crypto.randomUUID() };
  experiences.unshift(newExp);
  await saveExperiences(experiences);
  return newExp;
}

export async function updateExperience(id: string, data: Partial<ExperienceData>): Promise<void> {
  const experiences = await getExperiences();
  const idx = experiences.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Experience not found");
  experiences[idx] = { ...experiences[idx], ...data };
  await saveExperiences(experiences);
}

export async function deleteExperience(id: string): Promise<void> {
  const experiences = await getExperiences();
  await saveExperiences(experiences.filter((e) => e.id !== id));
}

// ---------------------------------------------------------------------------
// Career: Education
// ---------------------------------------------------------------------------

export async function getEducation(): Promise<EducationData[]> {
  const careerId = await getCareerFolderId();
  const { data } = await readOrCreate<EducationData[]>(careerId, "education.json", []);
  return data;
}

export async function saveEducation(education: EducationData[]): Promise<void> {
  const careerId = await getCareerFolderId();
  const fileId = await findFileByName(careerId, "education.json");
  if (fileId) {
    await updateJsonFile(fileId, education);
  } else {
    await createJsonFile(careerId, "education.json", education);
  }
}

export async function addEducationItem(edu: Omit<EducationData, "id">): Promise<EducationData> {
  const education = await getEducation();
  const newEdu: EducationData = { ...edu, id: crypto.randomUUID() };
  education.unshift(newEdu);
  await saveEducation(education);
  return newEdu;
}

export async function updateEducationItem(id: string, data: Partial<EducationData>): Promise<void> {
  const education = await getEducation();
  const idx = education.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Education not found");
  education[idx] = { ...education[idx], ...data };
  await saveEducation(education);
}

export async function deleteEducationItem(id: string): Promise<void> {
  const education = await getEducation();
  await saveEducation(education.filter((e) => e.id !== id));
}

// ---------------------------------------------------------------------------
// Career: Skills
// ---------------------------------------------------------------------------

export async function getSkills(): Promise<SkillData[]> {
  const careerId = await getCareerFolderId();
  const { data } = await readOrCreate<SkillData[]>(careerId, "skills.json", []);
  return data;
}

export async function saveSkills(skills: SkillData[]): Promise<void> {
  const careerId = await getCareerFolderId();
  const fileId = await findFileByName(careerId, "skills.json");
  if (fileId) {
    await updateJsonFile(fileId, skills);
  } else {
    await createJsonFile(careerId, "skills.json", skills);
  }
}

export async function addSkill(skill: Omit<SkillData, "id">): Promise<SkillData> {
  const skills = await getSkills();
  const newSkill: SkillData = { ...skill, id: crypto.randomUUID() };
  skills.push(newSkill);
  await saveSkills(skills);
  return newSkill;
}

export async function deleteSkill(id: string): Promise<void> {
  const skills = await getSkills();
  await saveSkills(skills.filter((s) => s.id !== id));
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

function resumeAppProperties(resume: DriveResumeFile): Record<string, string> {
  return {
    appName: "resume-maker",
    type: "resume",
    resumeId: resume.id,
    title: (resume.title || "").slice(0, 100),
    status: resume.status,
    jobTitle: (resume.jobTitle || "").slice(0, 100),
    companyName: (resume.companyName || "").slice(0, 100),
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
  };
}

export async function listResumes(): Promise<ResumeListItem[]> {
  const resumesFolderId = await getResumesFolderId();
  // Find all resume.json files inside the resumes/ folder tree that have our appProperties
  const q = `'${resumesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const folders = await driveQuery(q, "files(id,name,appProperties)");

  // For each folder, find the resume.json and read its appProperties
  const items: ResumeListItem[] = [];

  for (const folder of folders) {
    const fileId = await findFileByName(folder.id, "resume.json");
    if (!fileId) continue;

    // Read appProperties from the file
    const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=id,appProperties`, {
      headers: headers(),
    });
    if (!metaRes.ok) continue;
    const meta = await metaRes.json();
    const props = meta.appProperties || {};

    items.push({
      id: props.resumeId || folder.name,
      title: props.title || folder.name,
      jobTitle: props.jobTitle || undefined,
      companyName: props.companyName || undefined,
      status: (props.status as ResumeStatus) || "DRAFT",
      createdAt: props.createdAt || "",
      updatedAt: props.updatedAt || "",
      driveFileId: fileId,
    });
  }

  // Sort by createdAt descending
  items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return items;
}

export async function getResume(resumeId: string): Promise<DriveResumeFile | null> {
  const resumesFolderId = await getResumesFolderId();
  const folderId = await findFileByName(resumesFolderId, resumeId);
  if (!folderId) return null;
  const fileId = await findFileByName(folderId, "resume.json");
  if (!fileId) return null;
  return readJsonFile<DriveResumeFile>(fileId);
}

export async function createResume(data: {
  title: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
}): Promise<DriveResumeFile> {
  const resumesFolderId = await getResumesFolderId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const resume: DriveResumeFile = {
    id,
    title: data.title,
    jobTitle: data.jobTitle,
    companyName: data.companyName,
    jobDescription: data.jobDescription,
    status: "DRAFT",
    comments: [],
    createdAt: now,
    updatedAt: now,
  };

  // Create folder for this resume
  const folderId = await getOrCreateFolder(resumesFolderId, id);

  // Create resume.json inside it
  await createJsonFile(folderId, "resume.json", resume, resumeAppProperties(resume));

  return resume;
}

export async function updateResume(
  resumeId: string,
  updates: Partial<DriveResumeFile>
): Promise<DriveResumeFile> {
  const resumesFolderId = await getResumesFolderId();
  const folderId = await findFileByName(resumesFolderId, resumeId);
  if (!folderId) throw new Error("Resume not found");
  const fileId = await findFileByName(folderId, "resume.json");
  if (!fileId) throw new Error("Resume file not found");

  const current = await readJsonFile<DriveResumeFile>(fileId);
  const updated: DriveResumeFile = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await updateJsonFile(fileId, updated, resumeAppProperties(updated));
  return updated;
}

export async function deleteResume(resumeId: string): Promise<void> {
  const resumesFolderId = await getResumesFolderId();
  const folderId = await findFileByName(resumesFolderId, resumeId);
  if (folderId) {
    await deleteFile(folderId);
  }
  // Clear any cached folder refs
  clearCache();
}

// ---------------------------------------------------------------------------
// Comments (stored inline in resume.json)
// ---------------------------------------------------------------------------

export async function addComment(
  resumeId: string,
  comment: Omit<CommentData, "id" | "status" | "createdAt" | "updatedAt">
): Promise<CommentData> {
  const resume = await getResume(resumeId);
  if (!resume) throw new Error("Resume not found");

  const now = new Date().toISOString();
  const newComment: CommentData = {
    ...comment,
    id: crypto.randomUUID(),
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  resume.comments.push(newComment);
  await updateResume(resumeId, { comments: resume.comments });
  return newComment;
}

export async function updateComment(
  resumeId: string,
  commentId: string,
  updates: Partial<CommentData>
): Promise<void> {
  const resume = await getResume(resumeId);
  if (!resume) throw new Error("Resume not found");

  const idx = resume.comments.findIndex((c) => c.id === commentId);
  if (idx === -1) throw new Error("Comment not found");

  resume.comments[idx] = {
    ...resume.comments[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await updateResume(resumeId, { comments: resume.comments });
}

export async function deleteComment(resumeId: string, commentId: string): Promise<void> {
  const resume = await getResume(resumeId);
  if (!resume) throw new Error("Resume not found");

  resume.comments = resume.comments.filter((c) => c.id !== commentId);
  await updateResume(resumeId, { comments: resume.comments });
}

// ---------------------------------------------------------------------------
// Export all as a namespace-like object for convenience
// ---------------------------------------------------------------------------

export const googleDrive = {
  setTokenAccessor,
  // Profile
  getProfile,
  saveProfile,
  // Career
  getExperiences,
  saveExperiences,
  addExperience,
  updateExperience,
  deleteExperience,
  getEducation,
  saveEducation,
  addEducationItem,
  updateEducationItem,
  deleteEducationItem,
  getSkills,
  saveSkills,
  addSkill,
  deleteSkill,
  // Resumes
  listResumes,
  getResume,
  createResume,
  updateResume,
  deleteResume,
  // Comments
  addComment,
  updateComment,
  deleteComment,
};
