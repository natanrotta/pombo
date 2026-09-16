import { Request, Response, NextFunction } from "express";
import { csrfProtection } from "./csrf.middleware";
import { ForbiddenError } from "@shared/error";
import {
  CSRF_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE,
} from "../helpers/auth-cookies";

interface MockReqOptions {
  method?: string;
  path?: string;
  cookie?: string;
  header?: string;
  authorization?: string;
  /** Presence of the httpOnly session cookie (cookie-auth web requests). */
  accessCookie?: boolean;
}

function mockReqResNext(opts: MockReqOptions = {}) {
  const req = {
    method: opts.method ?? "POST",
    path: opts.path ?? "/api/contacts",
    cookies: {
      ...(opts.cookie !== undefined && { [CSRF_TOKEN_COOKIE]: opts.cookie }),
      ...(opts.accessCookie && { [ACCESS_TOKEN_COOKIE]: "session-jwt" }),
    },
    headers: {
      ...(opts.header !== undefined && { "x-csrf-token": opts.header }),
      ...(opts.authorization !== undefined && {
        authorization: opts.authorization,
      }),
    },
  } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe("csrfProtection", () => {
  describe("safe HTTP methods", () => {
    it.each(["GET", "HEAD", "OPTIONS"])(
      "lets %s through unconditionally",
      (method) => {
        const { req, res, next } = mockReqResNext({ method });

        csrfProtection(req, res, next);

        expect(next).toHaveBeenCalledWith();
      },
    );
  });

  describe("unauthenticated unsafe request (no Authorization header)", () => {
    it("passes when there is no CSRF cookie (public endpoint like sign-in)", () => {
      const { req, res, next } = mockReqResNext({ method: "POST" });

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("rejects when a CSRF cookie is present but header is missing", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        cookie: "csrf-abc",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects when a CSRF cookie is present and the header does not match", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        cookie: "csrf-abc",
        header: "csrf-wrong",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes when the cookie + header match (happy path)", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        cookie: "csrf-abc",
        header: "csrf-abc",
      });

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("authenticated unsafe request (Authorization header present)", () => {
    const authHeader = "Bearer some-token";

    it("rejects when the CSRF cookie is missing", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        authorization: authHeader,
        header: "csrf-abc",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects when the X-CSRF-Token header is missing", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        authorization: authHeader,
        cookie: "csrf-abc",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects when the cookie and header disagree", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        authorization: authHeader,
        cookie: "csrf-abc",
        header: "csrf-wrong",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes when cookie + header + Authorization are all present and matching", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        authorization: authHeader,
        cookie: "csrf-abc",
        header: "csrf-abc",
      });

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("cookie-authenticated unsafe request (pombo_at session cookie, no Authorization header)", () => {
    it("rejects when the session cookie is present but the CSRF cookie is missing (fail-closed)", () => {
      // The key hardening: a pombo_at-authenticated POST must NOT slip through
      // the unauthenticated branch just because the CSRF cookie is absent.
      const { req, res, next } = mockReqResNext({
        method: "POST",
        accessCookie: true,
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects when the session cookie is present and the CSRF header does not match", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        accessCookie: true,
        cookie: "csrf-abc",
        header: "csrf-wrong",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
    });

    it("passes when the session cookie + matching CSRF cookie & header are present", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        accessCookie: true,
        cookie: "csrf-abc",
        header: "csrf-abc",
      });

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("credential-issuing public endpoints with a leftover session cookie", () => {
    const PUBLIC_PATHS = [
      "/api/auth/sign-up",
      "/api/auth/sign-in",
      "/api/auth/google",
      "/api/auth/password/request-reset",
      "/api/auth/password/reset",
    ];

    it.each(PUBLIC_PATHS)(
      "lets %s through when a stale pombo_at remains but no CSRF cookie does",
      (path) => {
        const { req, res, next } = mockReqResNext({ path, accessCookie: true });

        csrfProtection(req, res, next);

        expect(next).toHaveBeenCalledWith();
      },
    );

    it.each(PUBLIC_PATHS)(
      "still enforces the double-submit on %s when a CSRF cookie is present",
      (path) => {
        const { req, res, next } = mockReqResNext({
          path,
          accessCookie: true,
          cookie: "csrf-abc",
        });

        expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      },
    );

    it("does not relax a credential endpoint called with a Bearer token", () => {
      const { req, res, next } = mockReqResNext({
        path: "/api/auth/sign-in",
        authorization: "Bearer api-client",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
    });

    it.each(["/api/auth/refresh", "/api/auth/sign-out", "/api/devices"])(
      "keeps the session-cookie rule on %s",
      (path) => {
        const { req, res, next } = mockReqResNext({ path, accessCookie: true });

        expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
      },
    );
  });

  describe("admin routes (Bearer-token auth, CSRF-exempt)", () => {
    it("passes an authenticated /api/admin/* unsafe request without any CSRF cookie/header", () => {
      const { req, res, next } = mockReqResNext({
        method: "PATCH",
        path: "/api/admin/feedback-reports/123/status",
        authorization: "Bearer support-token",
      });

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("does not exempt a non-admin path that merely contains 'admin'", () => {
      const { req, res, next } = mockReqResNext({
        method: "POST",
        path: "/api/accounts/admin-invite",
        authorization: "Bearer token",
        cookie: "csrf-abc",
      });

      expect(() => csrfProtection(req, res, next)).toThrow(ForbiddenError);
    });
  });
});
