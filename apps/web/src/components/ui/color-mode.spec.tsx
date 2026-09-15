import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { ColorModeProvider, useColorMode } from "@/components/ui/color-mode";
import { COLOR_MODE_STORAGE_KEY } from "@/app/theme";

/**
 * Guards the two contracts the v2 → v3 color-mode swap had to preserve:
 * the storage key (a returning user keeps the mode they picked) and the
 * "never report an unresolved mode as dark" fallback.
 */
function wrapper({ children }: PropsWithChildren) {
  return (
    <ColorModeProvider
      defaultTheme="system"
      storageKey={COLOR_MODE_STORAGE_KEY}
    >
      {children}
    </ColorModeProvider>
  );
}

describe("useColorMode", () => {
  it("keeps the pre-v3 storage key so a returning user's choice survives", () => {
    expect(COLOR_MODE_STORAGE_KEY).toBe("pombo-color-mode");
  });

  it("resolves to light rather than reporting an unresolved mode as dark", () => {
    const { result } = renderHook(() => useColorMode(), { wrapper });
    expect(result.current.colorMode).toBe("light");
  });

  it("toggles to dark and persists the explicit choice under the storage key", () => {
    const { result } = renderHook(() => useColorMode(), { wrapper });

    act(() => result.current.toggleColorMode());

    expect(result.current.colorMode).toBe("dark");
    expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe("dark");
  });

  it("setColorMode writes the requested mode", () => {
    const { result } = renderHook(() => useColorMode(), { wrapper });

    act(() => result.current.setColorMode("dark"));
    expect(result.current.colorMode).toBe("dark");

    act(() => result.current.setColorMode("light"));
    expect(result.current.colorMode).toBe("light");
  });
});
