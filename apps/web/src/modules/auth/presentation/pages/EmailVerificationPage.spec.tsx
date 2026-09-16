import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorCodes } from "@pombo/shared-types";
import { renderWithProviders } from "@/test/render";
import { EmailVerificationPage } from "./EmailVerificationPage";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { AppError } from "@/core/errors/AppError";
import authPtBR from "@/shared/i18n/locales/pt-BR/auth.json";

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
const discardEmailVerificationMock = vi.fn();
vi.mock("@/modules/auth/presentation/context/useAuth", () => ({
  useAuth: () => ({
    sendVerificationPin: sendVerificationPinMock,
    verifyEmailPin: verifyEmailPinMock,
    discardEmailVerification: discardEmailVerificationMock,
    isSubmitting: false,
  }),
}));

const showErrorMock = vi.fn();
const showSuccessMock = vi.fn();
const showInfoMock = vi.fn();
vi.mock("@/shared/hooks/useNotify", () => ({
  useNotify: () => ({
    showError: showErrorMock,
    showSuccess: showSuccessMock,
    showInfo: showInfoMock,
    showWarning: vi.fn(),
    showAutoSaved: vi.fn(),
  }),
}));

describe("EmailVerificationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const RESEND_COOLDOWN_MS = 60_000;

  const alreadyVerifiedError = () =>
    new AppError(
      "já verificado",
      ErrorCodes.AUTH_EMAIL_ALREADY_VERIFIED,
      409,
    );

  function expectLeftForSignIn() {
    expect(discardEmailVerificationMock).toHaveBeenCalledTimes(1);
    expect(showInfoMock).toHaveBeenCalledWith(
      authPtBR.verifyEmail.alreadyVerified,
    );
    expect(navigateMock).toHaveBeenCalledWith(ROUTE_PATHS.signIn, {
      replace: true,
    });
    expect(showErrorMock).not.toHaveBeenCalled();
  }

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

  it("leaves for sign-in when the initial send reports the e-mail is already verified", async () => {
    sendVerificationPinMock.mockRejectedValueOnce(alreadyVerifiedError());

    renderWithProviders(<EmailVerificationPage />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expectLeftForSignIn();
  });

  it("swallows a rate-limited initial send without an error toast", async () => {
    sendVerificationPinMock.mockRejectedValueOnce(
      new AppError(
        "aguarde",
        ErrorCodes.AUTH_EMAIL_VERIFICATION_RATE_LIMITED,
        429,
      ),
    );

    renderWithProviders(<EmailVerificationPage />);

    await waitFor(() =>
      expect(sendVerificationPinMock).toHaveBeenCalledTimes(1),
    );
    // Let the rejected send settle before asserting nothing reacted to it.
    await act(async () => {});
    expect(showErrorMock).not.toHaveBeenCalled();
    expect(showInfoMock).not.toHaveBeenCalled();
    expect(discardEmailVerificationMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows the send-error toast when the initial send fails for another reason", async () => {
    const failure = new AppError("falhou", ErrorCodes.INTERNAL_ERROR, 500);
    sendVerificationPinMock.mockRejectedValueOnce(failure);

    renderWithProviders(<EmailVerificationPage />);

    await waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith(
        failure,
        authPtBR.verifyEmail.sendError,
      ),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  describe("resend", () => {
    // Only the cooldown ticker is faked: waitFor/userEvent keep real
    // setTimeout, so the rest of the test runs on the real clock.
    function renderWithFakeCooldown() {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const view = renderWithProviders(<EmailVerificationPage />);
      expect(sendVerificationPinMock).toHaveBeenCalledTimes(1);
      return view;
    }

    function finishCooldown() {
      act(() => {
        vi.advanceTimersByTime(RESEND_COOLDOWN_MS);
      });
      vi.useRealTimers();
    }

    it("leaves for sign-in when a resend reports the e-mail is already verified", async () => {
      renderWithFakeCooldown();
      expect(
        screen.getByRole("button", { name: /reenviar em 60s/i }),
      ).toBeDisabled();
      finishCooldown();
      sendVerificationPinMock.mockRejectedValueOnce(alreadyVerifiedError());

      const resend = screen.getByRole("button", { name: /^reenviar$/i });
      expect(resend).toBeEnabled();
      await userEvent.click(resend);

      await waitFor(() => expect(navigateMock).toHaveBeenCalled());
      expect(sendVerificationPinMock).toHaveBeenCalledTimes(2);
      expectLeftForSignIn();
      expect(showSuccessMock).not.toHaveBeenCalled();
    });

    it("confirms a successful resend and restarts the cooldown", async () => {
      renderWithFakeCooldown();
      finishCooldown();

      await userEvent.click(screen.getByRole("button", { name: /^reenviar$/i }));

      await waitFor(() =>
        expect(showSuccessMock).toHaveBeenCalledWith(
          authPtBR.verifyEmail.resendSuccess,
        ),
      );
      expect(sendVerificationPinMock).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole("button", { name: /reenviar em 60s/i }),
      ).toBeDisabled();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });
});
