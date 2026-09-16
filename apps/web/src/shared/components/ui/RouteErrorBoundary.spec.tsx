import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { RouteErrorBoundary } from "@/shared/components/ui/RouteErrorBoundary";

const { reportRenderError, reloadForStaleChunk } = vi.hoisted(() => ({
  reportRenderError: vi.fn(),
  reloadForStaleChunk: vi.fn(),
}));

vi.mock("@/shared/lib/error-reporter", () => ({ reportRenderError }));
vi.mock("@/shared/utils/chunkReload", () => ({ reloadForStaleChunk }));

function Boom({ error }: { error: Error }): never {
  throw error;
}

/**
 * Every authenticated page renders inside this boundary, so a page crash that
 * isn't reported here never reaches Bugsnag. Stale-chunk failures are deploy
 * noise: they reload instead of reporting.
 */
describe("RouteErrorBoundary", () => {
  beforeEach(() => {
    reportRenderError.mockClear();
    reloadForStaleChunk.mockClear();
    // React logs caught render errors to console.error; keep the output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports a render crash and shows the fallback", async () => {
    const error = new Error("boom");

    renderWithProviders(
      <RouteErrorBoundary locationKey="/devices">
        <Boom error={error} />
      </RouteErrorBoundary>,
    );

    expect(await screen.findByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
    expect(reportRenderError).toHaveBeenCalledTimes(1);
    expect(reportRenderError).toHaveBeenCalledWith(error, expect.any(String));
    expect(reloadForStaleChunk).not.toHaveBeenCalled();
  });

  it("reloads on a stale-chunk error without reporting it", async () => {
    renderWithProviders(
      <RouteErrorBoundary locationKey="/devices">
        <Boom error={new Error("Failed to fetch dynamically imported module: /x.js")} />
      </RouteErrorBoundary>,
    );

    expect(await screen.findByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
    expect(reloadForStaleChunk).toHaveBeenCalledTimes(1);
    expect(reportRenderError).not.toHaveBeenCalled();
  });
});
