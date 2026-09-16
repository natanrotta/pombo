import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ErrorCodes,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@pombo/shared-types";
import { AppError } from "@/core/errors/AppError";
import settingsPtBR from "@/shared/i18n/locales/pt-BR/settings.json";
import { renderWithProviders } from "@/test/render";

const profileCopy = settingsPtBR.profile;

const uploadAvatarMock = vi.fn();

vi.mock("@/modules/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/auth")>("@/modules/auth");
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: "user-1",
        name: "Ana Teste",
        email: "ana@teste.com",
        emailVerified: true,
        avatarUrl: "",
        language: "pt-BR",
      },
      isAuthenticated: true,
      isLoading: false,
      isSubmitting: false,
      uploadAvatar: uploadAvatarMock,
    }),
  };
});

const showSuccessMock = vi.fn();
vi.mock("@/shared/hooks/useNotify", () => ({
  useNotify: () => ({
    showSuccess: showSuccessMock,
    showAutoSaved: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

const handleErrorMock = vi.fn();
vi.mock("@/core/query/useErrorHandler", () => ({
  useErrorHandler: () => ({ handleError: handleErrorMock }),
}));

const { ProfileAvatarCard } = await import("./ProfileAvatarCard");

const PREVIEW_URL = "blob:avatar-preview";
const createObjectURLMock = vi.fn((_file: Blob) => PREVIEW_URL);
const revokeObjectURLMock = vi.fn((_url: string) => undefined);
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function imageFile({
  type = "image/png",
  size = 1024,
  name = "avatar.png",
}: { type?: string; size?: number; name?: string } = {}): File {
  const file = new File(["x"], name, { type });
  // Fake the byte count so the size gate can be probed without allocating MBs.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

async function renderCard() {
  const view = renderWithProviders(<ProfileAvatarCard />);
  // Chakra's Avatar settles its image-loading state right after mount; flush
  // it inside act so it doesn't leak into the assertions as a warning.
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const fileInput = view.container.querySelector<HTMLInputElement>(
    'input[type="file"]',
  );
  if (!fileInput) throw new Error("file input not rendered");
  // `applyAccept: false` mimics a user switching the OS picker to "All files",
  // so the component's own gate is what gets exercised.
  const user = userEvent.setup({ applyAccept: false });
  return { ...view, fileInput, user };
}

describe("ProfileAvatarCard", () => {
  beforeEach(() => {
    uploadAvatarMock.mockReset();
    uploadAvatarMock.mockResolvedValue(undefined);
    showSuccessMock.mockReset();
    handleErrorMock.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("exposes the avatar as a button named after the change-avatar action", async () => {
    await renderCard();

    const button = screen.getByRole("button", {
      name: profileCopy.changeAvatar,
    });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-busy", "false");
  });

  it("opens the file picker when the avatar button is activated", async () => {
    const { fileInput, user } = await renderCard();
    const pickerClick = vi.spyOn(fileInput, "click");

    await user.click(
      screen.getByRole("button", { name: profileCopy.changeAvatar }),
    );

    expect(pickerClick).toHaveBeenCalledTimes(1);
  });

  it("limits the picker to the shared image allowlist", async () => {
    const { fileInput } = await renderCard();

    expect(fileInput.accept).toBe(ALLOWED_IMAGE_MIME_TYPES.join(","));
  });

  it("rejects a file over the upload limit without uploading it", async () => {
    const { fileInput, user } = await renderCard();

    await user.upload(
      fileInput,
      imageFile({ size: MAX_IMAGE_UPLOAD_BYTES + 1 }),
    );

    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    expect(handleErrorMock).toHaveBeenCalledWith(
      undefined,
      profileCopy.avatarTooLarge,
    );
    expect(uploadAvatarMock).not.toHaveBeenCalled();
    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(showSuccessMock).not.toHaveBeenCalled();
    expect(fileInput.value).toBe("");
  });

  it("accepts a file exactly at the upload limit", async () => {
    const { fileInput, user } = await renderCard();
    const file = imageFile({ size: MAX_IMAGE_UPLOAD_BYTES });

    await user.upload(fileInput, file);

    await waitFor(() => expect(uploadAvatarMock).toHaveBeenCalledWith(file));
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an SVG", "image/svg+xml", "avatar.svg"],
    ["a PDF", "application/pdf", "avatar.pdf"],
    ["an HEIC photo", "image/heic", "avatar.heic"],
    ["a file with no type", "", "avatar"],
  ])("rejects %s without uploading it", async (_label, type, name) => {
    const { fileInput, user } = await renderCard();

    await user.upload(fileInput, imageFile({ type, name }));

    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    expect(handleErrorMock).toHaveBeenCalledWith(
      undefined,
      profileCopy.avatarInvalidType,
    );
    expect(uploadAvatarMock).not.toHaveBeenCalled();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it("reports the invalid type first when a file is both too large and not allowed", async () => {
    const { fileInput, user } = await renderCard();

    await user.upload(
      fileInput,
      imageFile({
        type: "image/svg+xml",
        name: "avatar.svg",
        size: MAX_IMAGE_UPLOAD_BYTES + 1,
      }),
    );

    expect(handleErrorMock).toHaveBeenCalledWith(
      undefined,
      profileCopy.avatarInvalidType,
    );
    expect(uploadAvatarMock).not.toHaveBeenCalled();
  });

  it.each(ALLOWED_IMAGE_MIME_TYPES)(
    "uploads a valid %s file and confirms it",
    async (type) => {
      const { fileInput, user } = await renderCard();
      const file = imageFile({ type });

      await user.upload(fileInput, file);

      await waitFor(() =>
        expect(showSuccessMock).toHaveBeenCalledWith(profileCopy.avatarUpdated),
      );
      expect(uploadAvatarMock).toHaveBeenCalledTimes(1);
      expect(uploadAvatarMock).toHaveBeenCalledWith(file);
      expect(createObjectURLMock).toHaveBeenCalledWith(file);
      expect(revokeObjectURLMock).toHaveBeenCalledWith(PREVIEW_URL);
      expect(handleErrorMock).not.toHaveBeenCalled();
      expect(fileInput.value).toBe("");
    },
  );

  it("marks the avatar button busy while the upload is in flight", async () => {
    let finishUpload: () => void = () => {};
    uploadAvatarMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const { fileInput, user } = await renderCard();
    const button = screen.getByRole("button", {
      name: profileCopy.changeAvatar,
    });

    await user.upload(fileInput, imageFile());

    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    finishUpload();
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
    expect(showSuccessMock).toHaveBeenCalledWith(profileCopy.avatarUpdated);
  });

  it("shows the local preview while uploading and drops the revoked blob after a success", async () => {
    let finishUpload: () => void = () => {};
    uploadAvatarMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const { container, fileInput, user } = await renderCard();
    const previewImage = () =>
      container.querySelector(`img[src="${PREVIEW_URL}"]`);

    await user.upload(fileInput, imageFile());

    await waitFor(() => expect(previewImage()).not.toBeNull());
    finishUpload();
    await waitFor(() =>
      expect(revokeObjectURLMock).toHaveBeenCalledWith(PREVIEW_URL),
    );
    expect(previewImage()).toBeNull();
  });

  it("reports an upload failure with the update-error message", async () => {
    const failure = new AppError("upload falhou", ErrorCodes.INTERNAL_ERROR, 500);
    uploadAvatarMock.mockRejectedValue(failure);
    const { fileInput, user } = await renderCard();

    await user.upload(fileInput, imageFile());

    await waitFor(() =>
      expect(handleErrorMock).toHaveBeenCalledWith(
        failure,
        profileCopy.avatarUpdateError,
      ),
    );
    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    expect(showSuccessMock).not.toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith(PREVIEW_URL);
    expect(
      screen.getByRole("button", { name: profileCopy.changeAvatar }),
    ).toHaveAttribute("aria-busy", "false");
  });
});
