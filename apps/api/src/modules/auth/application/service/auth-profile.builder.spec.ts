import "reflect-metadata";
import { AuthProfileBuilder } from "./auth-profile.builder";
import { makeUser } from "@modules/user/test/user.factory";

describe("AuthProfileBuilder", () => {
  const sut = new AuthProfileBuilder();

  it("projects the user onto a MeResponseDTO", () => {
    const user = makeUser({
      id: "u-1",
      name: "Dra. Ana",
      email: "ana@test.com",
      emailVerified: true,
      avatarUrl: "https://cdn/pic.png",
      language: "en",
      status: "ACTIVE",
    });

    const profile = sut.buildProfile(user);

    expect(profile).toEqual({
      id: "u-1",
      name: "Dra. Ana",
      email: "ana@test.com",
      emailVerified: true,
      avatarUrl: "https://cdn/pic.png",
      language: "en",
      status: "ACTIVE",
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  });

  it("does not leak sensitive fields", () => {
    const profile = sut.buildProfile(makeUser());

    expect(profile).not.toHaveProperty("password");
    expect(profile).not.toHaveProperty("tokenVersion");
    expect(profile).not.toHaveProperty("refreshTokenHash");
  });
});
