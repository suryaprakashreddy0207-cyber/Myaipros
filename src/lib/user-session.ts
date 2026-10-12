export interface AppUserSession {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  isNewUser: boolean;
  loginAt: string;
}

export interface RegisteredAccount {
  uid: string;
  email: string;
  password?: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: string;
  lastLoginAt: string;
}

const ACTIVE_SESSION_KEY = "myaipro_active_user_session_v1";
const REGISTERED_USERS_KEY = "myaipro_registered_users_v1";
const LEGACY_MIGRATED_OWNER_KEY = "myaipro_legacy_history_owner_v1";

export function normalizeEmailKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "");
}

export function deriveUidFromEmail(email: string): string {
  const clean = normalizeEmailKey(email);
  return `usr_${clean.replace(/[^a-z0-9]/g, "_")}`;
}

export function getRegisteredAccounts(): Record<string, RegisteredAccount> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRegisteredAccounts(accounts: Record<string, RegisteredAccount>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors
  }
}

export function getActiveUserSession(): AppUserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && parsed.uid) {
      return parsed as AppUserSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function getActiveUserStorageKey(): string {
  if (typeof window === "undefined") return "guest";
  const session = getActiveUserSession();
  if (session?.email) {
    return normalizeEmailKey(session.email);
  }
  if (session?.uid) {
    return session.uid;
  }
  return "guest";
}

/**
 * Migrate pre-existing unscoped localStorage history to the FIRST returning ("old") user
 * so existing users keep their history while new users get a completely clean slate.
 */
function handleUserHistoryLifecycle(emailKey: string, isNewUser: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const scopedThreadsKey = `myaipro_chat_threads_v2_${emailKey}`;
    const scopedBuildsKey = `myaibro.builds.${emailKey}`;
    const scopedProjectsKey = `myaipro_projects_v1_${emailKey}`;

    if (isNewUser) {
      // Brand-new user: ensure their history starts 100% empty
      if (!localStorage.getItem(scopedThreadsKey)) {
        localStorage.setItem(scopedThreadsKey, JSON.stringify([]));
      }
      if (!localStorage.getItem(scopedBuildsKey)) {
        localStorage.setItem(scopedBuildsKey, JSON.stringify([]));
      }
      if (!localStorage.getItem(scopedProjectsKey)) {
        localStorage.setItem(scopedProjectsKey, JSON.stringify([]));
      }
      // Also clear the default thread messages for this new user
      localStorage.removeItem(`myaipro_chat_messages_v2_${emailKey}_default`);
      return;
    }

    // Returning ("old") user: if they don't have scoped history yet, check if legacy unscoped history exists
    const legacyOwner = localStorage.getItem(LEGACY_MIGRATED_OWNER_KEY);
    if (!legacyOwner || legacyOwner === emailKey) {
      const legacyThreads = localStorage.getItem("myaipro_chat_threads_v2");
      if (legacyThreads && !localStorage.getItem(scopedThreadsKey)) {
        localStorage.setItem(scopedThreadsKey, legacyThreads);
        localStorage.setItem(LEGACY_MIGRATED_OWNER_KEY, emailKey);
      }

      const legacyBuilds = localStorage.getItem("myaibro.builds");
      if (legacyBuilds && !localStorage.getItem(scopedBuildsKey)) {
        localStorage.setItem(scopedBuildsKey, legacyBuilds);
        localStorage.setItem(LEGACY_MIGRATED_OWNER_KEY, emailKey);
      }

      const legacyProjects = localStorage.getItem("myaipro_projects_v1");
      if (legacyProjects && !localStorage.getItem(scopedProjectsKey)) {
        localStorage.setItem(scopedProjectsKey, legacyProjects);
        localStorage.setItem(LEGACY_MIGRATED_OWNER_KEY, emailKey);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Record a login or signup and return the active user session.
 * Automatically distinguishes between an OLD (returning) user and a NEW user.
 */
export function establishUserSession(params: {
  email: string;
  password?: string;
  displayName?: string | null;
  photoURL?: string | null;
  firebaseUid?: string;
  mode?: "signin" | "signup" | "google";
}): AppUserSession {
  const emailKey = normalizeEmailKey(params.email);
  const accounts = getRegisteredAccounts();
  const existing = accounts[emailKey];

  // Check if there is any existing legacy history in this browser and if this is the known owner email
  const hasLegacyData =
    typeof window !== "undefined" &&
    Boolean(
      localStorage.getItem("myaipro_chat_threads_v2") ||
        localStorage.getItem("myaibro.builds") ||
        localStorage.getItem("myaipro_projects_v1"),
    );
  const legacyOwner =
    typeof window !== "undefined"
      ? localStorage.getItem(LEGACY_MIGRATED_OWNER_KEY)
      : null;

  // Determine whether this user is an OLD user or a NEW user:
  // - If `existing` is in accounts -> OLD user (isNewUser = false)
  // - If `mode === "signin"` or `mode === "google"` and they already have scoped data in localStorage -> OLD user
  // - If `mode === "signin"` or `mode === "google"` and no one has claimed legacy data yet and `Object.keys(accounts).length === 0` and hasLegacyData -> treat as returning owner if signing in, UNLESS mode === "signup"
  const hasScopedData =
    typeof window !== "undefined" &&
    Boolean(
      localStorage.getItem(`myaipro_chat_threads_v2_${emailKey}`) ||
        localStorage.getItem(`myaibro.builds.${emailKey}`) ||
        localStorage.getItem(`myaipro_projects_v1_${emailKey}`),
    );

  const isReturningUser =
    Boolean(existing) ||
    hasScopedData ||
    (params.mode !== "signup" &&
      hasLegacyData &&
      (!legacyOwner || legacyOwner === emailKey) &&
      Object.keys(accounts).length === 0);

  const isNewUser = !isReturningUser;

  const uid = existing?.uid || params.firebaseUid || deriveUidFromEmail(emailKey);
  const displayName =
    params.displayName ||
    existing?.displayName ||
    emailKey.split("@")[0] ||
    "User";
  const now = new Date().toISOString();

  accounts[emailKey] = {
    uid,
    email: emailKey,
    password: params.password || existing?.password,
    displayName,
    photoURL: params.photoURL ?? existing?.photoURL ?? null,
    createdAt: existing?.createdAt || now,
    lastLoginAt: now,
  };
  saveRegisteredAccounts(accounts);

  handleUserHistoryLifecycle(emailKey, isNewUser);

  const session: AppUserSession = {
    uid,
    email: emailKey,
    displayName,
    photoURL: params.photoURL ?? existing?.photoURL ?? null,
    isNewUser,
    loginAt: now,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem("myaipro_guest_id", uid);
    window.dispatchEvent(new CustomEvent("myaipro_auth_changed", { detail: session }));
  }

  return session;
}

export function clearActiveUserSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    window.dispatchEvent(new CustomEvent("myaipro_auth_changed", { detail: null }));
  } catch {
    // ignore
  }
}
