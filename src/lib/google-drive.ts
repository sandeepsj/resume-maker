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

function clearFolderCache() {
  folderCache.clear();
}

// ---------------------------------------------------------------------------
// Data cache — stale-while-revalidate pattern
//
// On read: return cached data immediately, fetch fresh in background.
// On write: update cache optimistically, then persist to Drive.
// Cache lives in memory (fast) with localStorage backup (survives refresh).
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "rm_cache_";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour — after this, cache is stale but still returned

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function cacheGet<T>(key: string): T | null {
  // Try memory first (fastest)
  const memKey = CACHE_PREFIX + key;
  const mem = _memCache.get(memKey);
  if (mem) return (mem as CacheEntry<T>).data;

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem(memKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    _memCache.set(memKey, entry);
    return entry.data;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T): void {
  const memKey = CACHE_PREFIX + key;
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  _memCache.set(memKey, entry);
  try {
    localStorage.setItem(memKey, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — memory cache still works
  }
}

function cacheDelete(key: string): void {
  const memKey = CACHE_PREFIX + key;
  _memCache.delete(memKey);
  try {
    localStorage.removeItem(memKey);
  } catch {}
}

function cacheClearAll(): void {
  _memCache.clear();
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

const _memCache = new Map<string, CacheEntry<unknown>>();

/**
 * Read-through cache: returns cached data if available, fetches fresh in background.
 * The `onUpdate` callback is called when fresh data arrives (so the UI can re-render).
 */
async function cachedRead<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate?: (data: T) => void,
): Promise<T> {
  const cached = cacheGet<T>(key);

  if (cached !== null) {
    // Return cached immediately, refresh in background
    fetcher().then((fresh) => {
      cacheSet(key, fresh);
      onUpdate?.(fresh);
    }).catch(() => {});
    return cached;
  }

  // No cache — must wait for fetch
  const data = await fetcher();
  cacheSet(key, data);
  return data;
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

// Raw fetchers (always hit Drive)
async function _fetchProfile(): Promise<UserProfileData> {
  const appId = await getAppFolderId();
  const { data } = await readOrCreate<UserProfileData>(appId, "profile.json", {
    id: "profile", headline: null, summary: null, phone: null, location: null,
    linkedinUrl: null, githubUrl: null, portfolioUrl: null,
  });
  return data;
}

async function _fetchExperiences(): Promise<ExperienceData[]> {
  const careerId = await getCareerFolderId();
  const { data } = await readOrCreate<ExperienceData[]>(careerId, "experiences.json", []);
  return data;
}

async function _fetchEducation(): Promise<EducationData[]> {
  const careerId = await getCareerFolderId();
  const { data } = await readOrCreate<EducationData[]>(careerId, "education.json", []);
  return data;
}

async function _fetchSkills(): Promise<SkillData[]> {
  const careerId = await getCareerFolderId();
  const { data } = await readOrCreate<SkillData[]>(careerId, "skills.json", []);
  return data;
}

// Cached getters — return instantly from cache, refresh from Drive in background
export async function getProfile(onUpdate?: (d: UserProfileData) => void): Promise<UserProfileData> {
  return cachedRead("profile", _fetchProfile, onUpdate);
}

export async function getExperiences(onUpdate?: (d: ExperienceData[]) => void): Promise<ExperienceData[]> {
  return cachedRead("experiences", _fetchExperiences, onUpdate);
}

export async function getEducation(onUpdate?: (d: EducationData[]) => void): Promise<EducationData[]> {
  return cachedRead("education", _fetchEducation, onUpdate);
}

export async function getSkills(onUpdate?: (d: SkillData[]) => void): Promise<SkillData[]> {
  return cachedRead("skills", _fetchSkills, onUpdate);
}

// Write functions — update cache optimistically, then persist to Drive

export async function saveProfile(profile: UserProfileData): Promise<void> {
  cacheSet("profile", profile);
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

async function _saveExperiences(experiences: ExperienceData[]): Promise<void> {
  cacheSet("experiences", experiences);
  const careerId = await getCareerFolderId();
  const fileId = await findFileByName(careerId, "experiences.json");
  if (fileId) {
    await updateJsonFile(fileId, experiences);
  } else {
    await createJsonFile(careerId, "experiences.json", experiences);
  }
}

export const saveExperiences = _saveExperiences;

export async function addExperience(exp: Omit<ExperienceData, "id">): Promise<ExperienceData> {
  const experiences = await _fetchExperiences();
  const newExp: ExperienceData = { ...exp, id: crypto.randomUUID() };
  experiences.unshift(newExp);
  await _saveExperiences(experiences);
  return newExp;
}

export async function updateExperience(id: string, data: Partial<ExperienceData>): Promise<void> {
  const experiences = await _fetchExperiences();
  const idx = experiences.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Experience not found");
  experiences[idx] = { ...experiences[idx], ...data };
  await _saveExperiences(experiences);
}

export async function deleteExperience(id: string): Promise<void> {
  const experiences = await _fetchExperiences();
  await _saveExperiences(experiences.filter((e) => e.id !== id));
}

// ---------------------------------------------------------------------------
// Career: Education
// ---------------------------------------------------------------------------

async function _saveEducation(education: EducationData[]): Promise<void> {
  cacheSet("education", education);
  const careerId = await getCareerFolderId();
  const fileId = await findFileByName(careerId, "education.json");
  if (fileId) {
    await updateJsonFile(fileId, education);
  } else {
    await createJsonFile(careerId, "education.json", education);
  }
}

export const saveEducation = _saveEducation;

export async function addEducationItem(edu: Omit<EducationData, "id">): Promise<EducationData> {
  const education = await _fetchEducation();
  const newEdu: EducationData = { ...edu, id: crypto.randomUUID() };
  education.unshift(newEdu);
  await _saveEducation(education);
  return newEdu;
}

export async function updateEducationItem(id: string, data: Partial<EducationData>): Promise<void> {
  const education = await _fetchEducation();
  const idx = education.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Education not found");
  education[idx] = { ...education[idx], ...data };
  await _saveEducation(education);
}

export async function deleteEducationItem(id: string): Promise<void> {
  const education = await _fetchEducation();
  await _saveEducation(education.filter((e) => e.id !== id));
}

// ---------------------------------------------------------------------------
// Career: Skills
// ---------------------------------------------------------------------------

async function _saveSkills(skills: SkillData[]): Promise<void> {
  cacheSet("skills", skills);
  const careerId = await getCareerFolderId();
  const fileId = await findFileByName(careerId, "skills.json");
  if (fileId) {
    await updateJsonFile(fileId, skills);
  } else {
    await createJsonFile(careerId, "skills.json", skills);
  }
}

export const saveSkills = _saveSkills;

export async function addSkill(skill: Omit<SkillData, "id">): Promise<SkillData> {
  const skills = await _fetchSkills();
  const newSkill: SkillData = { ...skill, id: crypto.randomUUID() };
  skills.push(newSkill);
  await _saveSkills(skills);
  return newSkill;
}

export async function deleteSkill(id: string): Promise<void> {
  const skills = await _fetchSkills();
  await _saveSkills(skills.filter((s) => s.id !== id));
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

async function _fetchResumes(): Promise<ResumeListItem[]> {
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

export async function listResumes(onUpdate?: (d: ResumeListItem[]) => void): Promise<ResumeListItem[]> {
  return cachedRead("resumes", _fetchResumes, onUpdate);
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

  cacheDelete("resumes"); // invalidate list cache
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
  cacheDelete("resumes"); // invalidate list cache
  return updated;
}

export async function deleteResume(resumeId: string): Promise<void> {
  const resumesFolderId = await getResumesFolderId();
  const folderId = await findFileByName(resumesFolderId, resumeId);
  if (folderId) {
    await deleteFile(folderId);
  }
  clearFolderCache();
  cacheDelete("resumes");
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

export { cacheClearAll as clearDataCache };

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
