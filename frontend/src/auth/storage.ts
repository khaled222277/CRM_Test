const TOKEN_KEY = "crm.access_token";

/**
 * Token storage.
 *
 * localStorage is readable by any script on the origin, so a successful XSS
 * can exfiltrate the token. That is an accepted trade-off for this project's
 * scope; the production-grade alternative is an httpOnly refresh cookie with a
 * short-lived in-memory access token.
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private-mode Safari and similar can throw on access.
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* nothing useful to do -- the session just won't survive a reload */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
