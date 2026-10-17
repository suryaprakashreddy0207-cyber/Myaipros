import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Silence internal Firestore network retry/timeout console errors so offline fallback works quietly
try {
  setLogLevel("silent");
} catch {
  // Ignore if setLogLevel fails
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

import { GithubAuthProvider, signInWithPopup } from "firebase/auth";

export const githubAuthProvider = new GithubAuthProvider();
githubAuthProvider.addScope("repo");
githubAuthProvider.addScope("read:user");

/**
 * Sign in with GitHub via Firebase Authentication.
 * Retrieves the OAuth credential and access token for accessing private repositories.
 */
export async function signInWithGithubFirebase() {
  const result = await signInWithPopup(auth, githubAuthProvider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  const user = result.user;
  return { user, token, credential };
}



