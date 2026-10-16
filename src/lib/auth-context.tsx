import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut as fbSignOut, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  getActiveUserSession,
  establishUserSession,
  clearActiveUserSession,
  type AppUserSession,
  normalizeEmailKey,
} from "@/lib/user-session";

interface AuthContextType {
  user: FirebaseUser | null;
  session: AppUserSession | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<AppUserSession | null>(() => getActiveUserSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial synchronous check from stored session
    const existing = getActiveUserSession();
    if (existing) {
      setSession(existing);
    }

    // 2. Firebase Auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser && currentUser.email) {
        const cleanEmail = normalizeEmailKey(currentUser.email);
        const name = currentUser.displayName || cleanEmail.split("@")[0] || "User";

        // Establish or refresh local user session
        const sess = establishUserSession({
          email: cleanEmail,
          displayName: name,
          photoURL: currentUser.photoURL,
          firebaseUid: currentUser.uid,
          mode: "signin",
        });
        setSession(sess);

        // Sync to Firestore in background
        try {
          setDoc(
            doc(db, "users", currentUser.uid),
            {
              id: currentUser.uid,
              email: currentUser.email,
              displayName: name,
              photoURL: currentUser.photoURL || "",
              lastLoginAt: new Date().toISOString(),
            },
            { merge: true },
          ).catch(() => {});
        } catch {
          // ignore
        }
      } else if (!currentUser) {
        // If Firebase says no user, but we have a valid session, keep session unless explicitly signed out
        const curSession = getActiveUserSession();
        setSession(curSession);
      }

      setLoading(false);
    });

    // Listen to internal app auth change events
    function handleAuthChanged() {
      const sess = getActiveUserSession();
      setSession(sess);
    }
    window.addEventListener("myaipro_auth_changed", handleAuthChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("myaipro_auth_changed", handleAuthChanged);
    };
  }, []);

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // ignore
    }
    clearActiveUserSession();
    setUser(null);
    setSession(null);
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  };

  const isAuthenticated = Boolean(user || session);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  return useContext(AuthContext);
}
