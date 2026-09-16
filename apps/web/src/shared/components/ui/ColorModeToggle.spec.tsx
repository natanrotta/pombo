import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

const { setColorModeMock, colorModeRef } = vi.hoisted(() => ({
  setColorModeMock: vi.fn(),
  colorModeRef: { current: "dark" as "dark" | "light" },
}));

vi.mock("@/components/ui/color-mode", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/ui/color-mode")>(
      "@/components/ui/color-mode",
    );
  return {
    ...actual,
    useColorMode: () => ({
      colorMode: colorModeRef.current,
      setColorMode: setColorModeMock,
      toggleColorMode: vi.fn(),
    }),
  };
});

const { ColorModeToggle } = await import("./ColorModeToggle");

describe("ColorModeToggle", () => {
  it("marks the current mode as pressed and the other as not", async () => {
    colorModeRef.current = "dark";
    renderWithProviders(<ColorModeToggle />);

    expect(screen.getByRole("button", { name: "Tema escuro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Tema claro" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches to the mode the user picks", async () => {
    colorModeRef.current = "dark";
    setColorModeMock.mockClear();
    renderWithProviders(<ColorModeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Tema claro" }));

    expect(setColorModeMock).toHaveBeenCalledWith("light");
  });

  it("re-picking the active mode is a no-op for the user, not a toggle", async () => {
    colorModeRef.current = "light";
    setColorModeMock.mockClear();
    renderWithProviders(<ColorModeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Tema claro" }));

    // It sets the SAME mode — never flips to the other one.
    expect(setColorModeMock).toHaveBeenCalledWith("light");
  });
});
