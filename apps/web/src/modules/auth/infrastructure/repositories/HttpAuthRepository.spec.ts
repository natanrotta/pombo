import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "@pombo/shared-types";
import { AppError } from "@/core/errors/AppError";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { HttpAuthRepository } from "./HttpAuthRepository";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/core/http/httpClient", () => ({
  httpClient: { get: getMock, post: postMock },
}));

const ME = {
  id: "u1",
  name: "Demo",
  email: "demo@example.com",
  emailVerified: true,
  avatarUrl: null,
  language: "pt-BR",
};

const expired = () =>
  new AppError("Token expired", ErrorCodes.AUTH_TOKEN_EXPIRED, 401);

describe("HttpAuthRepository.getCurrentUser", () => {
  const repository = new HttpAuthRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("returns the signed-in user from the session probe", async () => {
    getMock.mockResolvedValueOnce(ME);

    const user = await repository.getCurrentUser();

    expect(user).toMatchObject({ id: "u1", email: "demo@example.com" });
    expect(getMock).toHaveBeenCalledWith("/auth/me", {
      skipSessionExpiredRedirect: true,
    });
    expect(postMock).not.toHaveBeenCalled();
  });

  it("renews an expired access token once and returns the restored session", async () => {
    getMock.mockRejectedValueOnce(expired()).mockResolvedValueOnce(ME);
    postMock.mockResolvedValueOnce({ token: "t", csrfToken: "c" });

    const user = await repository.getCurrentUser();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith(
      "/auth/refresh",
      {},
      { skipSessionExpiredRedirect: true },
    );
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(user).toMatchObject({ id: "u1" });
  });

  it("treats the visitor as signed out when the renewal fails", async () => {
    getMock.mockRejectedValueOnce(expired());
    postMock.mockRejectedValueOnce(
      new AppError("Invalid refresh token", ErrorCodes.AUTH_TOKEN_INVALID, 401),
    );

    await expect(repository.getCurrentUser()).resolves.toBeNull();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry forever when the probe still says expired after renewing", async () => {
    getMock.mockRejectedValueOnce(expired()).mockRejectedValueOnce(expired());
    postMock.mockResolvedValueOnce({ token: "t", csrfToken: "c" });

    await expect(repository.getCurrentUser()).resolves.toBeNull();
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["an invalid token", new AppError("x", ErrorCodes.AUTH_TOKEN_INVALID, 401)],
    ["a revoked token", new AppError("x", ErrorCodes.AUTH_TOKEN_REVOKED, 401)],
    ["no token", new AppError("x", ErrorCodes.AUTH_NO_TOKEN, 401)],
    ["a network failure", new AppError("x", "NETWORK_ERROR", 0)],
    ["a non-AppError", new Error("boom")],
  ])("returns null without renewing on %s", async (_label, error) => {
    getMock.mockRejectedValueOnce(error);

    await expect(repository.getCurrentUser()).resolves.toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("skips the probe while an e-mail verification is pending", async () => {
    sessionStorage.setItem(STORAGE_KEYS.emailVerifyToken, "scoped");

    await expect(repository.getCurrentUser()).resolves.toBeNull();
    expect(getMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });
});
