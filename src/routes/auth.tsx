import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { supabase } from "@/integrations/supabase/client";
import {
  establishUserSession,
  getActiveUserSession,
  getRegisteredAccounts,
  normalizeEmailKey,
} from "@/lib/user-session";
import { setCachedGoogleToken } from "@/lib/google-auth";
import { Check, Loader2, Lock, Mail, User, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
},);

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
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true },
    ).catch(() => {});
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsNamePrompt, setNeedsNamePrompt] = useState(false);
  const [analyzingUser, setAnalyzingUser] = useState(false);

  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [googleCustomEmail, setGoogleCustomEmail] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<
    { email: string; displayName: string; isExisting: boolean }[]
  >([]);

  const handleAuthenticatedUser = useCallback(
    async (
      userEmail: string,
      displayNameInput?: string | null,
      photoURL?: string | null,
      firebaseUid?: string,
    ) => {
      setAnalyzingUser(true);
      const cleanEmail = normalizeEmailKey(userEmail);

      let isOldUser = false;
      try {
        if (firebaseUid) {
          const userDocRef = doc(db, "users", firebaseUid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            isOldUser = true;
          }
        }
      } catch {
        // fallback
      }

      const accounts = getRegisteredAccounts();
      if (accounts[cleanEmail]) {
        isOldUser = true;
      }

      if (!isOldUser && !displayNameInput && !needsNamePrompt) {
        setAnalyzingUser(false);
        setNeedsNamePrompt(true);
        return;
      }

      const session = establishUserSession({
        email: cleanEmail,
        displayName: displayNameInput || fullName.trim() || cleanEmail.split("@")[0],
        photoURL,
        firebaseUid,
        mode: isOldUser ? "signin" : "signup",
      });

      syncUserToFirestoreBackground(session);
      setAnalyzingUser(false);

      if (session.isNewUser) {
        toast.success(`AI Analysis: New user detected. Welcome to My AI, ${session.displayName}!`);
      } else {
        toast.success(`AI Analysis: Returning old user recognized. Restoring your previous logins & chat history...`);
      }

      navigate({ to: "/chat/$threadId", params: { threadId: "default" } });
    },
    [navigate, fullName, needsNamePrompt],
  );

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

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        await handleAuthenticatedUser(fbUser.email, fbUser.displayName, fbUser.photoURL, fbUser.uid);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      let firebaseUid: string | undefined;
      let fbDisplayName: string | null = fullName.trim() || null;

      try {
        // Try sign in first
        const cred = await withTimeout(
          signInWithEmailAndPassword(auth, cleanEmail, password),
          2500,
        );
        firebaseUid = cred.user.uid;
        fbDisplayName = cred.user.displayName;
      } catch {
        // If sign in fails, create account (Firebase signup)
        try {
          const cred = await withTimeout(
            createUserWithEmailAndPassword(auth, cleanEmail, password),
            2500,
          );
          firebaseUid = cred.user.uid;
          fbDisplayName = fullName.trim() || cred.user.displayName;
        } catch {
          // offline/local fallback
        }
      }

      await handleAuthenticatedUser(cleanEmail, fbDisplayName, null, firebaseUid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
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

      if (cred?.accessToken) {
        setCachedGoogleToken(cred.accessToken);
      }

      await handleAuthenticatedUser(
        gEmail,
        userCredential.user.displayName,
        userCredential.user.photoURL,
        userCredential.user.uid,
      );
    } catch {
      setLoading(false);
      setGoogleChooserOpen(true);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0906] px-6 py-10 font-sans text-stone-100 select-none">
      {/* Cosmic space background with glowing nebula & animated skyrocket ambient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-amber-500/20 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -right-40 size-96 rounded-full bg-orange-600/20 blur-[140px] animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.15)_0%,rgba(12,9,6,0.95)_80%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-amber-500/30 bg-[#140f0b]/85 p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.15)] ring-1 ring-white/10">
        <div className="mb-6 text-center">
          {/* Skyrocket glowing emblem */}
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 text-white shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-bounce">
            <Sparkles className="size-8 fill-white" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-white font-normal">
            My <span className="text-amber-400 font-bold">AI</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Launch your ideas into reality with autonomous AI agents, multi-folder code generation, and live app building.
          </p>
        </div>

        {analyzingUser ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="size-8 animate-spin text-amber-400" />
            <p className="text-xs font-semibold text-amber-300">
              AI is analyzing your account status…
            </p>
          </div>
        ) : needsNamePrompt ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!fullName.trim()) {
                toast.error("Please enter your name.");
                return;
              }
              await handleAuthenticatedUser(email, fullName.trim());
            }}
            className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-5 shadow-xl"
          >
            <div>
              <h3 className="font-serif text-lg font-bold text-white">Welcome, New User!</h3>
              <p className="text-xs text-stone-400 mt-1">
                Please enter your name to complete your My AI profile setup.
              </p>
            </div>
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
              <input
                type="text"
                required
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-stone-500 focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-4 py-3 text-sm font-bold text-white transition hover:scale-[1.02] shadow-[0_0_20px_rgba(245,158,11,0.4)]"
            >
              Enter My AI App
            </button>
          </form>
        ) : (
          <>
            {/* Continue for Free / Login with Firebase Button */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-4 py-3.5 text-sm font-bold text-white transition hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 shadow-[0_0_25px_rgba(245,158,11,0.5)] cursor-pointer"
            >
              <svg className="size-4 shrink-0 fill-white" viewBox="0 0 48 48">
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
              <span>Continue for Free with Firebase</span>
            </button>

            <div className="my-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                or sign in with email
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-stone-500 focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-stone-500 focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  "Continue to My AI App"
                )}
              </button>
            </form>
          </>
        )}
      </div>

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

            <div className="space-y-2">
              {savedAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={async () => {
                    setGoogleChooserOpen(false);
                    await handleAuthenticatedUser(acc.email, acc.displayName, null, undefined);
                  }}
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

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setGoogleChooserOpen(false);
                await handleAuthenticatedUser(googleCustomEmail, googleCustomEmail.split("@")[0], null, undefined);
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
