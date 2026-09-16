import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { useRecentRecipients } from "./useRecentRecipients";

const KEY = STORAGE_KEYS.sandboxRecentRecipients;

const store = (value: unknown) =>
  localStorage.setItem(KEY, JSON.stringify(value));

const stored = (): unknown => {
  const raw = localStorage.getItem(KEY);
  return raw === null ? null : JSON.parse(raw);
};

describe("useRecentRecipients", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial read", () => {
    it("starts empty when nothing is stored", () => {
      const { result } = renderHook(() => useRecentRecipients());

      expect(result.current.recents).toEqual([]);
    });

    it("keeps only digit strings from storage, in stored order", () => {
      store(["5511999990001", 42, "abc", "+55 11 9999", null, "5511999990002"]);

      const { result } = renderHook(() => useRecentRecipients());

      expect(result.current.recents).toEqual(["5511999990001", "5511999990002"]);
    });

    it("caps the stored list at 5 entries", () => {
      store(["1", "2", "3", "4", "5", "6", "7"]);

      const { result } = renderHook(() => useRecentRecipients());

      expect(result.current.recents).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("ignores a stored value that is not an array", () => {
      store({ phone: "5511999990001" });

      const { result } = renderHook(() => useRecentRecipients());

      expect(result.current.recents).toEqual([]);
    });

    it("ignores malformed JSON", () => {
      localStorage.setItem(KEY, "[not json");

      const { result } = renderHook(() => useRecentRecipients());

      expect(result.current.recents).toEqual([]);
    });

    it("starts empty when reading storage throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage disabled");
      });

      const { result } = renderHook(() => useRecentRecipients());

      expect(result.current.recents).toEqual([]);
    });
  });

  describe("addRecipient", () => {
    it("stores the number as digits only, most recent first", () => {
      store(["5511999990001"]);
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.addRecipient("+55 (11) 99999-0002"));

      expect(result.current.recents).toEqual(["5511999990002", "5511999990001"]);
      expect(stored()).toEqual(["5511999990002", "5511999990001"]);
    });

    it("moves an already-known number to the front without duplicating it", () => {
      store(["5511999990001", "5511999990002", "5511999990003"]);
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.addRecipient("+55 (11) 99999-0003"));

      expect(result.current.recents).toEqual([
        "5511999990003",
        "5511999990001",
        "5511999990002",
      ]);
      expect(stored()).toEqual(result.current.recents);
    });

    it("keeps at most 5 numbers, dropping the oldest", () => {
      store(["1000000001", "1000000002", "1000000003", "1000000004", "1000000005"]);
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.addRecipient("1000000006"));

      expect(result.current.recents).toEqual([
        "1000000006",
        "1000000001",
        "1000000002",
        "1000000003",
        "1000000004",
      ]);
      expect(stored()).toEqual(result.current.recents);
    });

    it("ignores a value with no digits", () => {
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.addRecipient("   "));
      act(() => result.current.addRecipient("abc"));

      expect(result.current.recents).toEqual([]);
      expect(stored()).toBeNull();
    });

    it("still updates the list when persisting throws", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.addRecipient("5511999990001"));

      expect(result.current.recents).toEqual(["5511999990001"]);
    });
  });

  describe("removeRecipient", () => {
    it("removes the number (matched by digits) and persists the list", () => {
      store(["5511999990001", "5511999990002"]);
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.removeRecipient("+55 (11) 99999-0001"));

      expect(result.current.recents).toEqual(["5511999990002"]);
      expect(stored()).toEqual(["5511999990002"]);
    });

    it("leaves the list unchanged when the number is unknown", () => {
      store(["5511999990001"]);
      const { result } = renderHook(() => useRecentRecipients());

      act(() => result.current.removeRecipient("5511000000000"));

      expect(result.current.recents).toEqual(["5511999990001"]);
    });

    it("still updates the list when persisting throws", () => {
      store(["5511999990001", "5511999990002"]);
      const { result } = renderHook(() => useRecentRecipients());
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });

      act(() => result.current.removeRecipient("5511999990002"));

      expect(result.current.recents).toEqual(["5511999990001"]);
    });
  });
});
