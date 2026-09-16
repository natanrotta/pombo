export const STORAGE_KEYS = {
  language: "@pombo-web:language",
  sidebarCollapsed: "@pombo-web:sidebar-collapsed",
  /** Scoped `email:verify` token held during the (pre-session) signup flow.
   *  Kept in **sessionStorage** (survives a same-tab refresh of /verify-email,
   *  clears on tab close) and sent as a Bearer ONLY on /auth/email-verification/*
   *  requests — see httpClient. The real session never uses this; it lives in
   *  the httpOnly access cookie. */
  emailVerifyToken: "@pombo-web:email-verify-token",
  /** Recently used Sandbox recipient numbers (raw digits, most-recent first),
   *  surfaced as suggestions when the recipient input is focused. Convenience
   *  only — cleared safely at any time, never contains sensitive data. */
  sandboxRecentRecipients: "@pombo-web:sandbox-recent-recipients",
} as const;

/** Prefix shared by every key this app writes to web storage. */
export const STORAGE_KEY_PREFIX = "@pombo-web:";

/** Device preferences — they belong to the browser, not to the signed-in
 *  account, so they survive a sign-out. Everything else under the prefix is
 *  session-scoped and is wiped (see `clearSessionScopedStorage`). */
export const DEVICE_PREFERENCE_KEYS: readonly string[] = [
  STORAGE_KEYS.language,
  STORAGE_KEYS.sidebarCollapsed,
];
