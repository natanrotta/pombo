import { DEVICE_PREFERENCE_KEYS, STORAGE_KEY_PREFIX } from "@/shared/constants/storageKeys";

function clearPrefixedKeys(storage: Storage): void {
  // Collect first: removing while iterating shifts the indexes.
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX) && !DEVICE_PREFERENCE_KEYS.includes(key)) {
      doomed.push(key);
    }
  }
  for (const key of doomed) storage.removeItem(key);
}

/**
 * Wipes every session-scoped key this app wrote to web storage (the scoped
 * e-mail-verify token, sandbox recent recipients, ...), keeping only the
 * device preferences. Called on every session end — explicit sign-out and the
 * session-expired path — so a shared browser never hands one account's data to
 * the next.
 */
export function clearSessionScopedStorage(): void {
  clearPrefixedKeys(localStorage);
  clearPrefixedKeys(sessionStorage);
}
