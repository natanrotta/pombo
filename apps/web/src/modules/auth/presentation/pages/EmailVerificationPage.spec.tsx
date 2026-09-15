import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { EmailVerificationPage } from "./EmailVerificationPage";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({
      state: { email: "john@test.com" },
      pathname: "/verify-email",
    }),
  };
});

const sendVerificationPinMock = vi.fn().mockResolvedValue(undefined);
const verifyEmailPinMock = vi.fn();
vi.mock("@/modules/auth/presentation/context/useAuth", () => ({
  useAuth: () => ({
    sendVerificationPin: sendVerificationPinMock,
    verifyEmailPin: verifyEmailPinMock,
    discardEmailVerification: vi.fn(),
    isSubmitting: false,
  }),
}));

const showErrorMock = vi.fn();
const showSuccessMock = vi.fn();
vi.mock("@/shared/hooks/useNotify", () => ({
  useNotify: () => ({
    showError: showErrorMock,
    showSuccess: showSuccessMock,
    showInfo: vi.fn(),
    showWarning: vi.fn(),
    showAutoSaved: vi.fn(),
  }),
}));

describe("EmailVerificationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Chakra PinInput auto-advances focus per keystroke, so `userEvent.type`
  // on a single field only registers the first char. Type one digit into
  // each field instead.
  //
  // `[data-part="input"]` selects only the visible digit boxes: v3's PinInput
  // also renders a `hidden-input` for form submission, so a bare `input`
  // selector would pick that one up first.
  const digitInputs = (container: HTMLElement) =>
    Array.from(
      container.querySelectorAll<HTMLInputElement>('input[data-part="input"]'),
    );

  async function fillPin(container: HTMLElement, code: string) {
    const inputs = digitInputs(container);
    for (let i = 0; i < code.length; i++) {
      await userEvent.type(inputs[i]!, code[i]!);
    }
  }

  it("dispatches the first PIN on mount and shows the email in the copy", async () => {
    const { container } = renderWithProviders(<EmailVerificationPage />);

    await waitFor(() =>
      expect(sendVerificationPinMock).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByText(/john@test\.com/)).toBeInTheDocument();
    // Six PIN fields are rendered.
    expect(digitInputs(container)).toHaveLength(6);
  });

  it("verifies the PIN and navigates to the post-auth destination", async () => {
    verifyEmailPinMock.mockResolvedValue({
      user: { emailVerified: true },
    });
    const { container } = renderWithProviders(<EmailVerificationPage />);
    await waitFor(() => expect(sendVerificationPinMock).toHaveBeenCalled());

    await fillPin(container, "123456");

    await waitFor(() =>
      expect(verifyEmailPinMock).toHaveBeenCalledWith("123456"),
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(ROUTE_PATHS.devices, {
        replace: true,
      }),
    );
  });

  it("shows an error when the PIN is wrong", async () => {
    verifyEmailPinMock.mockRejectedValue(new Error("bad pin"));
    const { container } = renderWithProviders(<EmailVerificationPage />);
    await waitFor(() => expect(sendVerificationPinMock).toHaveBeenCalled());

    await fillPin(container, "000000");

    await waitFor(() =>
      expect(verifyEmailPinMock).toHaveBeenCalledWith("000000"),
    );
    await waitFor(() => expect(showErrorMock).toHaveBeenCalled());
  });
});
