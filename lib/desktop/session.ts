const SESSION_KEY = "finnacialux-desktop-session-user";
const REMEMBERED_SESSION_KEY = "finnacialux-desktop-remembered-user";

export function readLocalSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SESSION_KEY)
    ?? window.localStorage.getItem(REMEMBERED_SESSION_KEY);
}

export function saveLocalSessionUserId(userId: string, remember = true): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, userId);
  if (remember) window.localStorage.setItem(REMEMBERED_SESSION_KEY, userId);
  else window.localStorage.removeItem(REMEMBERED_SESSION_KEY);
}

export function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(REMEMBERED_SESSION_KEY);
}
