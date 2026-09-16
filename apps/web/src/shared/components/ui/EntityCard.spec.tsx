import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiCamera } from "@/shared/components/icons";
import { renderWithProviders } from "@/test/render";
import { EntityCard } from "./EntityCard";

/** Every emotion rule (selector + body) generated for `element`'s class. */
function injectedRulesFor(element: HTMLElement): string[] {
  const className = [...element.classList].find((c) => c.startsWith("css-"));
  if (!className) throw new Error("element has no emotion class");
  const stylesheet = [...document.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .join("\n");
  const rule = new RegExp(`[^{}]*\\.${className}(?![\\w-])[^{]*\\{[^}]*\\}`, "g");
  return [...stylesheet.matchAll(rule)].map(([text]) => text.trim());
}

describe("EntityCard", () => {
  it("reveals the quick actions from the card's group hover", () => {
    const { container } = renderWithProviders(
      <EntityCard
        title="Atendimento"
        quickActions={[{ icon: FiCamera, label: "Abrir", onClick: vi.fn() }]}
      />,
    );

    const card = container.querySelector<HTMLElement>('[data-cy="entity-card"]');
    const actions = screen.getByRole("button", { name: "Abrir" }).parentElement!;

    // Chakra v3's `_groupHover` compiles to `.group:is(:hover…) &`.
    expect(card).not.toBeNull();
    expect(card).toHaveClass("group");
    expect(card).not.toHaveAttribute("role", "group");
    const groupHoverRule = injectedRulesFor(actions).find((rule) =>
      rule.includes(".group:is(:hover"),
    );
    expect(groupHoverRule).toMatch(/opacity:1/);
  });

  it("runs the quick action without opening the card", async () => {
    const onAction = vi.fn();
    const onOpen = vi.fn();
    renderWithProviders(
      <EntityCard
        title="Atendimento"
        onClick={onOpen}
        quickActions={[{ icon: FiCamera, label: "Abrir", onClick: onAction }]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
