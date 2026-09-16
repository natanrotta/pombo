import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { clearSessionScopedStorage } from "./sessionStorageCleanup";

describe("clearSessionScopedStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("removes session-scoped app keys from both storages", () => {
    localStorage.setItem(STORAGE_KEYS.sandboxRecentRecipients, "[\"5511999999999\"]");
    sessionStorage.setItem(STORAGE_KEYS.emailVerifyToken, "scoped-jwt");

    clearSessionScopedStorage();

    expect(localStorage.getItem(STORAGE_KEYS.sandboxRecentRecipients)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.emailVerifyToken)).toBeNull();
  });

  it("keeps the device preferences (language and sidebar)", () => {
    localStorage.setItem(STORAGE_KEYS.language, "en");
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, "true");

    clearSessionScopedStorage();

    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe("en");
    expect(localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe("true");
  });

  it("leaves keys outside the app prefix untouched", () => {
    localStorage.setItem("pombo-color-mode", "dark");
    localStorage.setItem("third-party", "x");

    clearSessionScopedStorage();

    expect(localStorage.getItem("pombo-color-mode")).toBe("dark");
    expect(localStorage.getItem("third-party")).toBe("x");
  });

  it("removes every matching key even when several are adjacent", () => {
    for (let i = 0; i < 5; i += 1) localStorage.setItem(`@pombo-web:tmp-${i}`, String(i));

    clearSessionScopedStorage();

    expect(localStorage.length).toBe(0);
  });
});
