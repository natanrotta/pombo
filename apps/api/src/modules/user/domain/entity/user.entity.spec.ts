import { makeUser } from "@modules/user/test/user.factory";

describe("User", () => {
  it("populates every getter from constructor props", () => {
    const user = makeUser();

    expect(user.id).toBeDefined();
    expect(user.name).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.password).toBe("hashed-password");
    expect(user.googleId).toBeNull();
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerified).toBe(true);
    expect(user.avatarUrl).toBeNull();
    expect(user.language).toBe("pt-BR");
    expect(user.tokenVersion).toBe(0);
    expect(user.tokenExpiresAt).toBeNull();
    expect(user.refreshTokenHash).toBeNull();
    expect(user.refreshTokenExpiresAt).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("isActive is true only for the ACTIVE status", () => {
    expect(makeUser({ status: "ACTIVE" }).isActive).toBe(true);
    expect(makeUser({ status: "PENDING" }).isActive).toBe(false);
  });

  it("handles optional/nullable fields with values", () => {
    const user = makeUser({
      googleId: "google-123",
      avatarUrl: "https://example.com/avatar.jpg",
      refreshTokenHash: "hashed-refresh-token-123",
    });

    expect(user.googleId).toBe("google-123");
    expect(user.avatarUrl).toBe("https://example.com/avatar.jpg");
    expect(user.refreshTokenHash).toBe("hashed-refresh-token-123");
  });

  it("returns toJSON with public fields only — ISO timestamps, no sensitive data", () => {
    const user = makeUser();
    const json = user.toJSON();

    expect(json).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      language: user.language,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

    expect(json).not.toHaveProperty("password");
    expect(json).not.toHaveProperty("googleId");
    expect(json).not.toHaveProperty("tokenVersion");
    expect(json).not.toHaveProperty("refreshToken");
  });
});
