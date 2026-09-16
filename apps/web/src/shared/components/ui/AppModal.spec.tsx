import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { AppModal } from "@/shared/components/ui/AppModal";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";

/**
 * AppModal moved from v2 `Modal` to v3 `Dialog`. Its public props are the
 * contract every call site depends on, so they are what this spec pins —
 * not the markup underneath.
 */
describe("AppModal", () => {
  it("renders the title and body only while open", async () => {
    const { rerender } = renderWithProviders(
      <AppModal isOpen={false} onClose={vi.fn()} title="Novo dispositivo">
        <p>corpo</p>
      </AppModal>,
    );
    expect(screen.queryByText("Novo dispositivo")).not.toBeInTheDocument();

    rerender(
      <AppModal isOpen onClose={vi.fn()} title="Novo dispositivo">
        <p>corpo</p>
      </AppModal>,
    );
    // The dialog portals in through zag's presence machine, so it lands on a
    // later tick than the rerender.
    expect(await screen.findByText("Novo dispositivo")).toBeInTheDocument();
    expect(screen.getByText("corpo")).toBeInTheDocument();
  });

  it("routes the footer cancel button to onClose", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AppModal isOpen onClose={onClose} title="Título">
        <p>corpo</p>
      </AppModal>,
    );

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires the primary action when it is enabled", async () => {
    const onPrimaryAction = vi.fn();
    renderWithProviders(
      <AppModal
        isOpen
        onClose={vi.fn()}
        title="Título"
        primaryActionLabel="Salvar"
        onPrimaryAction={onPrimaryAction}
      >
        <p>corpo</p>
      </AppModal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it("does not fire the primary action while it is disabled", async () => {
    const onPrimaryAction = vi.fn();
    renderWithProviders(
      <AppModal
        isOpen
        onClose={vi.fn()}
        title="Título"
        primaryActionLabel="Salvar"
        onPrimaryAction={onPrimaryAction}
        isPrimaryDisabled
      >
        <p>corpo</p>
      </AppModal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onPrimaryAction).not.toHaveBeenCalled();
  });

  it("prefers onCancelAction over onClose when one is supplied", async () => {
    const onClose = vi.fn();
    const onCancelAction = vi.fn();
    renderWithProviders(
      <AppModal
        isOpen
        onClose={onClose}
        title="Título"
        onCancelAction={onCancelAction}
        cancelActionLabel="Descartar"
      >
        <p>corpo</p>
      </AppModal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onCancelAction).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * v3 folded AlertDialog into Dialog, so the "focus the safe button, not the
 * destructive one" behaviour moved from `leastDestructiveRef` to
 * `initialFocusEl`. That swap is the one semantic change in this component.
 */
describe("ConfirmDialog", () => {
  it("never puts initial focus on the destructive action", async () => {
    // The invariant that matters: a stray Enter right after the dialog opens
    // must not confirm a destructive action. `initialFocusEl` aims focus at
    // Cancel; jsdom does not reproduce zag's focus management faithfully enough
    // to assert *that*, so this pins the safety property instead — focus is
    // anywhere but the destructive button.
    const { rerender } = renderWithProviders(
      <ConfirmDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />,
    );
    rerender(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />,
    );

    const confirm = await screen.findByRole("button", { name: "Excluir" });
    await waitFor(() => expect(confirm).not.toHaveFocus());
  });

  it("fires onConfirm from the destructive action", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Excluir" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // The button recipe's `solid` variant ignores `colorPalette`, so the
  // destructive CTA once rendered brand green. jsdom resolves no computed
  // colors, so these read the rules emotion injected for the button's class.
  it("paints the destructive action with the recipe's danger variant", async () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Excluir"
      />,
    );

    const css = injectedCssFor(
      await screen.findByRole("button", { name: "Excluir" }),
    );
    expect(css).toContain("background:var(--chakra-colors-red-500)");
    expect(css).not.toContain("background:var(--chakra-colors-bg-brand-solid)");
  });

  it("keeps the brand solid variant when the action is not destructive", async () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Confirmar"
        isDanger={false}
      />,
    );

    const css = injectedCssFor(
      await screen.findByRole("button", { name: "Confirmar" }),
    );
    expect(css).toContain("background:var(--chakra-colors-bg-brand-solid)");
    expect(css).not.toContain("background:var(--chakra-colors-red-");
  });
});

function injectedCssFor(element: HTMLElement): string {
  const className = [...element.classList].find((c) => c.startsWith("css-"));
  if (!className) throw new Error("element has no emotion class");
  const stylesheet = [...document.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .join("\n");
  const rule = new RegExp(`\\.${className}(?![\\w-])[^{]*\\{([^}]*)\\}`, "g");
  return [...stylesheet.matchAll(rule)].map(([, body]) => body).join(";");
}
