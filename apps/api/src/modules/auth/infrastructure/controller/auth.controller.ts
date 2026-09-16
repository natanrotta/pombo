import { Request, Response } from "express";
import { container } from "tsyringe";
import { randomUUID } from "crypto";
import type {
  ApiSuccessResponse,
  GoogleSignInResponseDTO,
  RefreshTokenResponseDTO,
  SignInResponseDTO,
  SignUpResponseDTO,
  VerifyEmailPinResponseDTO,
} from "@pombo/shared-types";
import {
  SignInUseCase,
  SignUpUseCase,
  SignOutUseCase,
  GetMeUseCase,
  RefreshTokenUseCase,
  UpdateProfileUseCase,
  UpdateAvatarUseCase,
  GoogleSignInUseCase,
  DeleteAccountUseCase,
  RequestPasswordResetUseCase,
  ResetPasswordUseCase,
  SendEmailVerificationPinUseCase,
  VerifyEmailPinUseCase,
} from "@modules/auth/application/use-case/auth";
import { UnauthorizedError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import {
  setAuthCookies,
  setAccessTokenCookie,
  setCsrfCookie,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE,
} from "@core/http/helpers/auth-cookies";

/**
 * The auth cookies are SameSite, so a cross-site request never carries them.
 * Clearing only when one arrived keeps a forged cross-site POST to
 * `/auth/refresh` from logging the user out.
 */
function carriesSessionCookie(req: Request): boolean {
  const cookies = req.cookies ?? {};
  return [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, CSRF_TOKEN_COOKIE].some(
    (name) => Boolean(cookies[name]),
  );
}

export class AuthController {
  async signIn(req: Request, res: Response): Promise<Response> {
    const signInUseCase = container.resolve(SignInUseCase);
    const result = await signInUseCase.execute(req.body);

    const csrfToken = randomUUID();
    setAuthCookies(res, result.refreshToken, csrfToken);
    setAccessTokenCookie(res, result.token);

    return res.status(200).json({
      ok: true,
      data: {
        user: result.user,
        token: result.token,
        csrfToken,
      },
    } satisfies ApiSuccessResponse<SignInResponseDTO>);
  }

  async signUp(req: Request, res: Response): Promise<Response> {
    const signUpUseCase = container.resolve(SignUpUseCase);
    const result = await signUpUseCase.execute(req.body);

    // No refresh cookie yet — the account is unverified. But the scoped
    // `email:verify` token the FE is about to use for send/verify-PIN POSTs
    // must pass the global double-submit CSRF check, so issue the CSRF cookie
    // (and echo the token in the body) now.
    const csrfToken = randomUUID();
    setCsrfCookie(res, csrfToken);

    return res.status(201).json({
      ok: true,
      data: { ...result, csrfToken },
    } satisfies ApiSuccessResponse<SignUpResponseDTO>);
  }

  async sendEmailVerificationPin(
    req: Request,
    res: Response,
  ): Promise<Response> {
    if (!req.emailVerifyAuth) {
      throw new UnauthorizedError(
        "No token",
        undefined,
        ErrorCodes.AUTH_NO_TOKEN,
      );
    }
    const useCase = container.resolve(SendEmailVerificationPinUseCase);
    await useCase.execute({ userId: req.emailVerifyAuth.userId });
    return res.status(204).send();
  }

  async verifyEmailPin(req: Request, res: Response): Promise<Response> {
    if (!req.emailVerifyAuth) {
      throw new UnauthorizedError(
        "No token",
        undefined,
        ErrorCodes.AUTH_NO_TOKEN,
      );
    }
    const useCase = container.resolve(VerifyEmailPinUseCase);
    const result = await useCase.execute({
      userId: req.emailVerifyAuth.userId,
      pin: req.body.pin,
    });

    const csrfToken = randomUUID();
    setAuthCookies(res, result.refreshToken, csrfToken);
    setAccessTokenCookie(res, result.token);

    return res.status(200).json({
      ok: true,
      data: { user: result.user, token: result.token, csrfToken },
    } satisfies ApiSuccessResponse<VerifyEmailPinResponseDTO>);
  }

  async signOut(req: Request, res: Response): Promise<Response> {
    const signOutUseCase = container.resolve(SignOutUseCase);
    await signOutUseCase.execute(req.auth.userId);
    clearAuthCookies(res);
    return res.status(204).send();
  }

  async me(req: Request, res: Response): Promise<Response> {
    const getMeUseCase = container.resolve(GetMeUseCase);
    const result = await getMeUseCase.execute(req.auth.userId);

    return res.status(200).json({ ok: true, data: result });
  }

  async updateProfile(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(UpdateProfileUseCase);
    const result = await useCase.execute(req.auth.userId, req.body);

    return res.status(200).json({ ok: true, data: result });
  }

  async updateAvatar(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(UpdateAvatarUseCase);
    const result = await useCase.execute(req.auth.userId, req.file!);

    return res.status(200).json({ ok: true, data: result });
  }

  async googleSignIn(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(GoogleSignInUseCase);
    const result = await useCase.execute(req.body);

    const csrfToken = randomUUID();
    setAuthCookies(res, result.refreshToken, csrfToken);
    setAccessTokenCookie(res, result.token);

    return res.status(result.kind === "sign-up" ? 201 : 200).json({
      ok: true,
      data: {
        kind: result.kind,
        user: result.user,
        token: result.token,
        csrfToken,
      },
    } satisfies ApiSuccessResponse<GoogleSignInResponseDTO>);
  }

  async refresh(req: Request, res: Response): Promise<Response> {
    const refreshTokenUseCase = container.resolve(RefreshTokenUseCase);

    // Read refresh token from httpOnly cookie (fallback to body for API clients).
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body.refreshToken;

    // A session that can't be renewed is over: drop its cookies with the error
    // so a dead `pombo_at` doesn't linger in the browser.
    const hasSessionCookie = carriesSessionCookie(req);
    if (!refreshToken) {
      if (hasSessionCookie) clearAuthCookies(res);
      throw new UnauthorizedError(
        "No refresh token",
        undefined,
        ErrorCodes.AUTH_NO_TOKEN,
      );
    }

    let result: Awaited<ReturnType<RefreshTokenUseCase["execute"]>>;
    try {
      result = await refreshTokenUseCase.execute(refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedError && hasSessionCookie) {
        clearAuthCookies(res);
      }
      throw error;
    }

    const csrfToken = randomUUID();
    setAuthCookies(res, result.refreshToken, csrfToken);
    setAccessTokenCookie(res, result.token);

    return res.status(200).json({
      ok: true,
      data: { token: result.token, csrfToken },
    } satisfies ApiSuccessResponse<RefreshTokenResponseDTO>);
  }

  async requestPasswordReset(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(RequestPasswordResetUseCase);
    await useCase.execute(req.body);
    return res.status(204).send();
  }

  async resetPassword(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(ResetPasswordUseCase);
    await useCase.execute(req.body);
    return res.status(204).send();
  }

  async deleteAccount(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(DeleteAccountUseCase);
    await useCase.execute(req.auth.userId);

    clearAuthCookies(res);

    return res.status(204).send();
  }
}
