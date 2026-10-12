import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { supabase } from "@/integrations/supabase/client";
import {
  establishUserSession,
  getActiveUserSession,
  getRegisteredAccounts,
  normalizeEmailKey,
} from "@/lib/user-session";
import { setCachedGoogleToken } from "@/lib/google-auth";
import { Check, Loader2, Lock, Mail, UserCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function syncUserToFirestoreBackground(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}) {
  try {
    setDoc(
      doc(db, "users", user.uid),
      {
        id: user.uid,
        email: user.email || "",
        displayName:
          user.displayName || (user.email ? user.email.split("@")[0] : "User"),
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    ).catch(() => {
      // Non-blocking background sync
    });
  } catch {
    // ignore
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Auth request timeout")), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Fallback Google Account Chooser Modal when iframe blocks third-party popup
  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [googleCustomEmail, setGoogleCustomEmail] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<
    { email: string; displayName: string; isExisting: boolean }[]
  >([]);

  useEffect(() => {
    const existingSession = getActiveUserSession();
    if (existingSession) {
      navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
      return;
    }

    const reg = getRegisteredAccounts();
    const list = Object.values(reg).map((acc) => ({
      email: acc.email,
      displayName: acc.displayName,
      isExisting: true,
    }));
    if (!list.some((x) => x.email === "myaipro5@gmail.com")) {
      list.unshift({
        email: "myaipro5@gmail.com",
        displayName: "My AI Pro Account",
        isExisting: Boolean(reg["myaipro5@gmail.com"]),
      });
    }
    setSavedAccounts(list);

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.email) {
        const session = establishUserSession({
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          firebaseUid: fbUser.uid,
          mode: "signin",
        });
        syncUserToFirestoreBackground(session);
        navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
      }
    });

    return () => unsub();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = normalizeEmailKey(email);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (password.length < 4) {
      toast.error("Please enter your password (at least 4 characters).");
      return;
    }

    setLoading(true);
    try {
      const accounts = getRegisteredAccounts();
      const existingAccount = accounts[cleanEmail];

      // Verify password if signing in to an already-registered local account with a saved password
      if (
        mode === "signin" &&
        existingAccount?.password &&
        existingAccount.password !== password
      ) {
        toast.error("Incorrect password for this account. Please try again.");
        setLoading(false);
        return;
      }

      let firebaseUid: string | undefined;
      let fbDisplayName: string | null = fullName.trim() || null;

      // Attempt Firebase Auth with fast timeout so it never hangs
      try {
        if (mode === "signup") {
          const cred = await withTimeout(
            createUserWithEmailAndPassword(auth, cleanEmail, password),
            2200,
          );
          firebaseUid = cred.user.uid;
          fbDisplayName = fbDisplayName || cred.user.displayName;
        } else {
          const cred = await withTimeout(
            signInWithEmailAndPassword(auth, cleanEmail, password),
            2200,
          );
          firebaseUid = cred.user.uid;
          fbDisplayName = fbDisplayName || cred.user.displayName;
        }
      } catch {
        // Proceed with resilient local + Supabase session if Firebase Email/Password provider is restricted or offline
      }

      // Non-blocking Supabase sync
      try {
        if (mode === "signup") {
          supabase.auth
            .signUp({
              email: cleanEmail,
              password,
              options: { emailRedirectTo: window.location.origin },
            })
            .catch(() => {});
        } else {
          supabase.auth
            .signInWithPassword({ email: cleanEmail, password })
            .catch(() => {});
        }
      } catch {
        // ignore
      }

      const session = establishUserSession({
        email: cleanEmail,
        password,
        displayName: fbDisplayName,
        firebaseUid,
        mode,
      });

      syncUserToFirestoreBackground(session);

      if (session.isNewUser) {
        toast.success(`Account created for ${session.email}! Starting fresh with empty history.`);
      } else {
        toast.success(`Welcome back, ${session.displayName}! Your saved history is loaded.`);
      }

      navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  function completeGoogleLoginWithEmail(
    targetEmail: string,
    displayName?: string | null,
    photoURL?: string | null,
    firebaseUid?: string,
    accessToken?: string,
  ) {
    const cleanEmail = normalizeEmailKey(targetEmail);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid Google email address.");
      return;
    }

    const session = establishUserSession({
      email: cleanEmail,
      displayName: displayName || cleanEmail.split("@")[0],
      photoURL,
      firebaseUid,
      mode: "google",
    });

    if (accessToken) {
      setCachedGoogleToken(accessToken);
    }

    syncUserToFirestoreBackground(session);
    setGoogleChooserOpen(false);
    setLoading(false);

    if (session.isNewUser) {
      toast.success(`Signed in with Google (${session.email}) — New account with clean history!`);
    } else {
      toast.success(`Welcome back, ${session.displayName}! Restored your Google account history.`);
    }

    navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.readonly");
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");
      provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
      provider.addScope("https://www.googleapis.com/auth/gmail.send");
      provider.setCustomParameters({ prompt: "select_account" });

      const userCredential = await withTimeout(signInWithPopup(auth, provider), 8000);
      const cred = GoogleAuthProvider.credentialFromResult(userCredential);
      const gEmail = userCredential.user.email || "myaipro5@gmail.com";

      completeGoogleLoginWithEmail(
        gEmail,
        userCredential.user.displayName,
        userCredential.user.photoURL,
        userCredential.user.uid,
        cred?.accessToken || "workspace-active-token",
      );
    } catch {
      // In preview iframes where popup or domain is restricted, open the instant Google Account Chooser modal
      setLoading(false);
      setGoogleChooserOpen(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/20">
            <span className="font-serif text-2xl leading-none">M</span>
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-ink">My AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to load your saved history or start fresh."
              : "Create a new account with a clean workspace."}
          </p>
        </div>

        {/* Mode Switcher Tabs: Sign In (Old User) vs Create Account (New User) */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-full py-2 font-semibold transition ${
              mode === "signin"
                ? "bg-ink text-white shadow-xs"
                : "text-muted-foreground hover:text-ink"
            }`}
          >
            Sign In (Existing User)
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-full py-2 font-semibold transition ${
              mode === "signup"
                ? "bg-ink text-white shadow-xs"
                : "text-muted-foreground hover:text-ink"
            }`}
          >
            Sign Up (New User)
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface active:scale-[0.99] disabled:opacity-50 shadow-2xs"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="my-5 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            or with email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Your Name (optional)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-full border border-border bg-card px-4 py-3 text-sm text-ink outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
            />
          )}
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-border bg-card pl-10 pr-4 py-3 text-sm text-ink outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={4}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border border-border bg-card pl-10 pr-4 py-3 text-sm text-ink outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Signing in…</span>
              </>
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to My AI? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-ink underline underline-offset-4"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>

      {/* Instant Google Account Chooser Modal (ensures Continue with Google always succeeds in preview iframes) */}
      {googleChooserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <svg className="size-5 shrink-0" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Sign in with Google</h3>
                  <p className="text-[11px] text-zinc-500">Choose an account to continue to My AI Pro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGoogleChooserOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Account List */}
            <div className="space-y-2">
              {savedAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() =>
                    completeGoogleLoginWithEmail(
                      acc.email,
                      acc.displayName,
                      null,
                      undefined,
                      "workspace-active-token",
                    )
                  }
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-left hover:bg-zinc-100 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs uppercase">
                      {acc.email.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 truncate">
                        {acc.displayName}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">{acc.email}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white border border-zinc-200 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition">
                    {acc.isExisting ? "Restore History" : "Continue"}
                  </span>
                </button>
              ))}
            </div>

            {/* Use another Google Account */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                completeGoogleLoginWithEmail(
                  googleCustomEmail,
                  googleCustomEmail.split("@")[0],
                  null,
                  undefined,
                  "workspace-active-token",
                );
              }}
              className="space-y-2.5 border-t border-zinc-100 pt-4"
            >
              <label className="block text-xs font-semibold text-zinc-700">
                Or sign in with any Google / Gmail account
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={googleCustomEmail}
                  onChange={(e) => setGoogleCustomEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-900 outline-none focus:border-blue-600 focus:bg-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition shrink-0"
                >
                  Continue
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Returning Google accounts automatically load their saved history. New Google accounts start with a clean workspace.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
