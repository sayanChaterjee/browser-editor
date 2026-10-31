import { clearLocalProjects } from "./indexedDB";
import { signOut } from "./auth-client";

/**
 * The user whose projects this browser keeps locally, so practice can open the last project
 * straight away while the backend wakes up. Forgotten on sign-out and whenever a sign-in page
 * opens (someone else may be about to sign in on this browser).
 */
const LAST_USER_KEY = "ceditor:lastUser";

// Storage can be unavailable (private windows, blocked site data): then nothing is remembered
export function rememberUser(userId: string) {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // not remembered
  }
}

export function rememberedUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function forgetUser() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // nothing to forget
  }
}

/** Signs out and removes this user's local copies from the browser. */
export async function signOutCompletely() {
  forgetUser();
  await clearLocalProjects().catch(() => {});
  await signOut();
}

// Contest projects are named "<title> · contest <id>" (components/contest/ContestWorkspace)
export const isContestProject = (name: string) => / · contest [0-9a-f]{4}$/.test(name);
