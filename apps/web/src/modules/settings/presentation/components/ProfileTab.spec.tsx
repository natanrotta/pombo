import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

const updateProfileMock = vi.fn().mockResolvedValue(null);
const uploadAvatarMock = vi.fn().mockResolvedValue(null);
const requestPasswordResetMock = vi.fn().mockResolvedValue(null);

interface ProfileTabUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  language: string;
}

const baseUser: ProfileTabUser = {
  id: "user-1",
  name: "Ana Teste",
  email: "ana@teste.com",
  emailVerified: true,
  avatarUrl: "",
  language: "pt-BR",
};

let currentUser: ProfileTabUser = baseUser;

vi.mock("@/modules/auth", async () => {
  const actual = await vi.importActual<typeof import("@/modules/auth")>("@/modules/auth");
  return {
    ...actual,
    useAuth: () => ({
      user: currentUser,
      isAuthenticated: true,
      isLoading: false,
      isSubmitting: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: updateProfileMock,
      uploadAvatar: uploadAvatarMock,
      requestPasswordReset: requestPasswordResetMock,
      resetPassword: vi.fn(),
    }),
  };
});

const showSuccessMock = vi.fn();
const showAutoSavedMock = vi.fn();
vi.mock("@/shared/hooks/useNotify", () => ({
  useNotify: () => ({
    showSuccess: showSuccessMock,
    showAutoSaved: showAutoSavedMock,
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

const handleErrorMock = vi.fn();
vi.mock("@/core/query/useErrorHandler", () => ({
  useErrorHandler: () => ({ handleError: handleErrorMock }),
}));

// Collapse the production 1500ms debounce so the autosave window closes
// well inside the default 5s vitest timeout.
vi.mock("@/shared/hooks/useDetailPageController", async () => {
  const actual = await vi.importActual<typeof import("@/shared/hooks/useDetailPageController")>(
    "@/shared/hooks/useDetailPageController"
  );
  return {
    ...actual,
    useDetailPageController: (opts: Parameters<typeof actual.useDetailPageController>[0]) =>
      actual.useDetailPageController({ ...opts, delay: 10 }),
  };
});

async function importTab() {
  const mod = await import("./ProfileTab");
  return mod.ProfileTab;
}

describe("ProfileTab", () => {
  beforeEach(() => {
    updateProfileMock.mockClear();
    updateProfileMock.mockResolvedValue(null);
    uploadAvatarMock.mockClear();
    requestPasswordResetMock.mockClear();
    showSuccessMock.mockClear();
    showAutoSavedMock.mockClear();
    handleErrorMock.mockClear();
    currentUser = baseUser;
  });

  it("renders the change-password action", async () => {
    const ProfileTab = await importTab();
    renderWithProviders(<ProfileTab />);

    expect(screen.getByRole("button", { name: /alterar senha/i })).toBeInTheDocument();
  });

  it("renders a single 'Salvar' button, disabled when not dirty", async () => {
    const ProfileTab = await importTab();
    renderWithProviders(<ProfileTab />);

    const saveButtons = screen.getAllByRole("button", { name: /^salvar$/i });
    expect(saveButtons).toHaveLength(1);
    expect(saveButtons[0]).toBeDisabled();
  });

  it("does NOT call updateProfile on initial render", async () => {
    const ProfileTab = await importTab();
    renderWithProviders(<ProfileTab />);

    await new Promise((r) => setTimeout(r, 100));
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("autosaves a name edit after the debounce window", async () => {
    const ProfileTab = await importTab();
    renderWithProviders(<ProfileTab />);

    const nameInput = screen.getByLabelText(/nome completo/i);
    await userEvent.type(nameInput, "!");

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ana Teste!" })
    );
  });

  it("does NOT autosave when the name field is emptied and says why", async () => {
    const ProfileTab = await importTab();
    renderWithProviders(<ProfileTab />);

    const nameInput = screen.getByLabelText(/nome completo/i);
    await userEvent.clear(nameInput);

    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    await new Promise((r) => setTimeout(r, 100));
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("requests a password reset for the current user email", async () => {
    const ProfileTab = await importTab();
    renderWithProviders(<ProfileTab />);

    await userEvent.click(screen.getByRole("button", { name: /alterar senha/i }));

    await waitFor(() =>
      expect(requestPasswordResetMock).toHaveBeenCalledWith({ email: "ana@teste.com" })
    );
  });
});
