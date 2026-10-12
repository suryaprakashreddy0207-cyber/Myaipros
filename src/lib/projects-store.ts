import { db, auth } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { getActiveUserSession, getActiveUserStorageKey } from "@/lib/user-session";

export interface ProjectSource {
  id: string;
  type: "drive" | "sheet" | "gmail" | "file";
  title: string;
  snippet?: string;
  mimeType?: string;
  size?: string;
  link?: string;
  addedAt: string;
}

export interface ProjectChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ProjectItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  instructions?: string;
  category?: "Homework" | "Investing" | "Writing" | "General";
  sharedWith: string[];
  isShared: boolean;
  sources: ProjectSource[];
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_PROJECTS_KEY = "myaipro_projects_v1";
const LOCAL_STORAGE_PROJECT_MSGS_PREFIX = "myaipro_project_msgs_";

function getProjectsStorageKey(): string {
  return getActiveUserStorageKey(LOCAL_STORAGE_PROJECTS_KEY);
}

function getProjectMsgsStorageKey(projectId: string): string {
  return getActiveUserStorageKey(`${LOCAL_STORAGE_PROJECT_MSGS_PREFIX}${projectId}`);
}

// Get current active user ID (or persistent guest fallback)
export function getCurrentUserId(): string {
  const session = getActiveUserSession();
  if (session?.uid) return session.uid;
  if (typeof window !== "undefined" && auth.currentUser) {
    return auth.currentUser.uid;
  }
  if (typeof window !== "undefined") {
    let guestId = localStorage.getItem("myaipro_guest_id");
    if (!guestId) {
      guestId = `guest-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("myaipro_guest_id", guestId);
    }
    return guestId;
  }
  return "guest-user";
}

export function getCurrentUserEmail(): string {
  const session = getActiveUserSession();
  if (session?.email) return session.email.toLowerCase();
  if (typeof window !== "undefined" && auth.currentUser?.email) {
    return auth.currentUser.email.toLowerCase();
  }
  return "guest@myaipro.app";
}

// Local storage helpers
export function getLocalProjects(): ProjectItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getProjectsStorageKey();
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      return JSON.parse(raw);
    }
    // For returning users, migrate legacy global projects if present
    const session = getActiveUserSession();
    if (session && !session.isNewUser) {
      const legacy = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem(key, JSON.stringify(parsed));
          return parsed;
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: ProjectItem[]) {
  if (typeof window === "undefined") return;
  try {
    const key = getProjectsStorageKey();
    localStorage.setItem(key, JSON.stringify(projects));
    window.dispatchEvent(new CustomEvent("myaipro_projects_updated", { detail: projects }));
  } catch {
    // ignore
  }
}

export function getLocalProjectMessages(projectId: string): ProjectChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getProjectMsgsStorageKey(projectId);
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      return JSON.parse(raw);
    }
    const session = getActiveUserSession();
    if (session && !session.isNewUser) {
      const legacy = localStorage.getItem(`${LOCAL_STORAGE_PROJECT_MSGS_PREFIX}${projectId}`);
      if (legacy) return JSON.parse(legacy);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveLocalProjectMessages(projectId: string, msgs: ProjectChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getProjectMsgsStorageKey(projectId),
      JSON.stringify(msgs),
    );
  } catch {
    // ignore
  }
}

// Fetch all projects (Local first, synced with Firestore with timeout protection)
export async function fetchProjects(): Promise<ProjectItem[]> {
  const local = getLocalProjects();
  const session = getActiveUserSession();
  // If user is brand new and has no local projects yet, do not pull global legacy projects
  if (session?.isNewUser && local.length === 0) {
    return [];
  }

  const firestoreSync = async (): Promise<ProjectItem[]> => {
    try {
      const coll = collection(db, "projects");
      const snap = await getDocs(coll);
      if (!snap.empty) {
        const serverProjects: ProjectItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          serverProjects.push({
            id: d.id,
            userId: data.userId || "",
            title: data.title || "Untitled Project",
            description: data.description || "",
            instructions: data.instructions || "",
            category: data.category || "General",
            sharedWith: Array.isArray(data.sharedWith) ? data.sharedWith : [],
            isShared: !!data.isShared,
            sources: Array.isArray(data.sources) ? data.sources : [],
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });

        // Merge server with local
        const currentLocal = getLocalProjects();
        const map = new Map<string, ProjectItem>();
        for (const p of currentLocal) map.set(p.id, p);
        for (const p of serverProjects) map.set(p.id, p);

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        saveLocalProjects(merged);
        return merged;
      }
    } catch {
      // fallback
    }
    return local;
  };

  const timeoutPromise = new Promise<ProjectItem[]>((resolve) => {
    setTimeout(() => resolve(local), 1000);
  });

  return Promise.race([firestoreSync(), timeoutPromise]);
}

// Get single project
export async function getProjectById(projectId: string): Promise<ProjectItem | null> {
  const local = getLocalProjects();
  const found = local.find((p) => p.id === projectId);

  try {
    const docRef = doc(db, "projects", projectId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const p: ProjectItem = {
        id: snap.id,
        userId: data.userId || "",
        title: data.title || "Untitled Project",
        description: data.description || "",
        instructions: data.instructions || "",
        category: data.category || "General",
        sharedWith: Array.isArray(data.sharedWith) ? data.sharedWith : [],
        isShared: !!data.isShared,
        sources: Array.isArray(data.sources) ? data.sources : [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      // update in local
      const next = local.filter((x) => x.id !== projectId).concat(p);
      saveLocalProjects(next);
      return p;
    }
  } catch {
    // ignore
  }

  return found || null;
}

// Create project (Instant 0ms latency!)
export async function createProject(params: {
  title: string;
  category?: "Homework" | "Investing" | "Writing" | "General";
  instructions?: string;
  description?: string;
}): Promise<ProjectItem> {
  const uid = getCurrentUserId();
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const newProj: ProjectItem = {
    id,
    userId: uid,
    title: params.title.trim(),
    category: params.category || "General",
    instructions: params.instructions?.trim() || "",
    description: params.description?.trim() || "",
    sharedWith: [],
    isShared: false,
    sources: [],
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save local immediately (0ms response time!)
  const local = getLocalProjects();
  saveLocalProjects([newProj, ...local.filter((p) => p.id !== id)]);

  // 2. Sync to Firestore in background without blocking
  setDoc(doc(db, "projects", id), newProj).catch((e) => {
    console.warn("Firestore create project offline sync queued:", e);
  });

  return newProj;
}

// Update project
export async function updateProject(
  projectId: string,
  updates: Partial<ProjectItem>,
): Promise<void> {
  const local = getLocalProjects();
  const updated = local.map((p) =>
    p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
  );
  saveLocalProjects(updated);

  try {
    await updateDoc(doc(db, "projects", projectId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

// Delete project
export async function deleteProject(projectId: string): Promise<void> {
  const local = getLocalProjects();
  saveLocalProjects(local.filter((p) => p.id !== projectId));

  try {
    await deleteDoc(doc(db, "projects", projectId));
  } catch {
    // ignore
  }
}

// Share project with email
export async function shareProjectWithEmail(
  projectId: string,
  email: string,
): Promise<{ success: boolean; shareLink: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const local = getLocalProjects();
  const target = local.find((p) => p.id === projectId);
  if (!target) throw new Error("Project not found");

  const existingShared = new Set(target.sharedWith || []);
  if (cleanEmail) existingShared.add(cleanEmail);

  const updatedSharedWith = Array.from(existingShared);
  await updateProject(projectId, {
    isShared: true,
    sharedWith: updatedSharedWith,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareLink = `${origin}/projects/${projectId}?shared=true`;
  return { success: true, shareLink };
}

// Add source to project
export async function addSourceToProject(
  projectId: string,
  source: Omit<ProjectSource, "id" | "addedAt">,
): Promise<ProjectSource> {
  const newSource: ProjectSource = {
    ...source,
    id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    addedAt: new Date().toISOString(),
  };

  const local = getLocalProjects();
  const proj = local.find((p) => p.id === projectId);
  if (proj) {
    const updatedSources = [newSource, ...(proj.sources || [])];
    await updateProject(projectId, { sources: updatedSources });
  }

  return newSource;
}

// Remove source from project
export async function removeSourceFromProject(
  projectId: string,
  sourceId: string,
): Promise<void> {
  const local = getLocalProjects();
  const proj = local.find((p) => p.id === projectId);
  if (proj) {
    const updatedSources = (proj.sources || []).filter((s) => s.id !== sourceId);
    await updateProject(projectId, { sources: updatedSources });
  }
}

// Add message to project chat
export async function addProjectChatMessage(
  projectId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ProjectChatMessage> {
  const newMsg: ProjectChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    created_at: new Date().toISOString(),
  };

  const existing = getLocalProjectMessages(projectId);
  const updated = [...existing, newMsg];
  saveLocalProjectMessages(projectId, updated);

  // Non-blocking firestore backup sync
  try {
    const msgDoc = doc(db, "projects", projectId, "messages", newMsg.id);
    setDoc(msgDoc, newMsg).catch(() => {});
  } catch {
    // ignore
  }

  return newMsg;
}
