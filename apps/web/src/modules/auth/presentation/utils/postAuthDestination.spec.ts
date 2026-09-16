import { describe, expect, it } from "vitest";
import {
  getPostAuthDestination,
  resolveSignInRedirect,
} from "./postAuthDestination";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import type { AuthUser } from "@/modules/auth/domain/entities/AuthUser";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    name: "Ana",
    email: "ana@test.com",
    emailVerified: true,
    avatarUrl: "",
    language: "pt-BR",
    ...overrides,
  };
}

describe("getPostAuthDestination", () => {
  it("redirects to sign-in when there is no user", () => {
    expect(getPostAuthDestination(null)).toBe(ROUTE_PATHS.signIn);
  });

  it("redirects to verify-email when the email is not verified", () => {
    expect(getPostAuthDestination(makeUser({ emailVerified: false }))).toBe(
      ROUTE_PATHS.verifyEmail
    );
  });

  it("redirects to devices for a verified user", () => {
    expect(getPostAuthDestination(makeUser())).toBe(ROUTE_PATHS.devices);
  });
});

describe("resolveSignInRedirect", () => {
  it("returns to the protected page stored in location.state.from", () => {
    const state = { from: { pathname: "/devices/abc/chat" } };

    expect(resolveSignInRedirect(state, makeUser())).toBe("/devices/abc/chat");
  });

  it("falls back to the post-auth destination when from points at sign-in itself", () => {
    const state = { from: { pathname: ROUTE_PATHS.signIn } };

    expect(resolveSignInRedirect(state, makeUser())).toBe(ROUTE_PATHS.devices);
  });

  it.each([
    ["null state", null],
    ["undefined state", undefined],
    ["a primitive state", "garbage"],
    ["a state without from", { email: "ana@test.com" }],
    ["a from without pathname", { from: {} }],
    ["a null from", { from: null }],
    ["an empty pathname", { from: { pathname: "" } }],
  ])("falls back to the post-auth destination for %s", (_label, state) => {
    expect(resolveSignInRedirect(state, makeUser())).toBe(ROUTE_PATHS.devices);
  });

  it("sends an unverified user to verify-email when there is no stored page", () => {
    expect(
      resolveSignInRedirect(null, makeUser({ emailVerified: false })),
    ).toBe(ROUTE_PATHS.verifyEmail);
  });

  it("sends an unverified user to verify-email when from points at sign-in", () => {
    const state = { from: { pathname: ROUTE_PATHS.signIn } };

    expect(
      resolveSignInRedirect(state, makeUser({ emailVerified: false })),
    ).toBe(ROUTE_PATHS.verifyEmail);
  });
});
