import type {
  GoogleSignInResponseDTO,
  MeResponseDTO,
  SignInResponseDTO,
  SignUpResponseDTO,
  VerifyEmailPinResponseDTO,
} from "@pombo/shared-types";
import { httpClient } from "@/core/http/httpClient";
import type { AuthRepository } from "@/modules/auth/domain/repositories/AuthRepository";
import type {
  AuthSession,
  AuthUser,
  SignInInput,
  SignUpInput,
  SignUpResult,
  GoogleSignInInput,
  UpdateProfileInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
} from "@/modules/auth/domain/entities/AuthUser";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { clearSessionScopedStorage } from "@/shared/utils/sessionStorageCleanup";

/** The API profile → the UI's user (the UI renders no avatar as `""`). */
function mapToAuthUser(data: MeResponseDTO): AuthUser {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    emailVerified: data.emailVerified,
    avatarUrl: data.avatarUrl ?? "",
    language: data.language,
  };
}

export class HttpAuthRepository implements AuthRepository {
  async signIn(input: SignInInput): Promise<AuthSession> {
    const data = await httpClient.post<never, SignInResponseDTO>("/auth/sign-in", {
      email: input.email,
      password: input.password,
    });
    return { user: mapToAuthUser(data.user) };
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const data = await httpClient.post<never, SignUpResponseDTO>("/auth/sign-up", {
      name: input.name,
      email: input.email,
      password: input.password,
      ...(input.language && { language: input.language }),
    });

    // Hold the scoped `email:verify` token in sessionStorage so the follow-up
    // send/verify-PIN calls can attach it as a Bearer (httpClient does this ONLY
    // for /auth/email-verification/* routes). It is a short-lived, pre-session
    // token — the real session rides the httpOnly cookie.
    sessionStorage.setItem(STORAGE_KEYS.emailVerifyToken, data.token);
    return { kind: "verify-email", email: data.email };
  }

  async sendVerificationPin(): Promise<void> {
    await httpClient.post("/auth/email-verification/send");
  }

  /**
   * Drops the scoped `email:verify` token when the user abandons the flow
   * (e.g. "back to sign up"). No network call — there is no session to end.
   */
  discardEmailVerification(): void {
    sessionStorage.removeItem(STORAGE_KEYS.emailVerifyToken);
  }

  async verifyEmailPin(pin: string): Promise<AuthSession> {
    const data = await httpClient.post<never, VerifyEmailPinResponseDTO>("/auth/email-verification/verify", {
      pin,
    });
    // The full session cookie is now set by the server — drop the scoped token.
    sessionStorage.removeItem(STORAGE_KEYS.emailVerifyToken);
    return { user: mapToAuthUser(data.user) };
  }

  async signInWithGoogle(input: GoogleSignInInput): Promise<AuthSession> {
    const data = await httpClient.post<never, GoogleSignInResponseDTO>("/auth/google", {
      credential: input.credential,
      ...(input.language && { language: input.language }),
    });
    return { user: mapToAuthUser(data.user) };
  }

  async signOut(): Promise<void> {
    try {
      // The server clears the httpOnly access + refresh cookies here.
      await httpClient.post("/auth/sign-out");
    } finally {
      // A shared device must never hand one account's browser data to the next.
      clearSessionScopedStorage();
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    // Mid e-mail-verification: a scoped token is pending and there is NO session
    // cookie yet — probing /me would 401 and bounce the user off /verify-email.
    // Treat it as "no session yet".
    if (sessionStorage.getItem(STORAGE_KEYS.emailVerifyToken)) return null;

    try {
      // Cookie-authenticated; resolves only with a valid session. A 401 here
      // means "not signed in" — flag the probe so the interceptor doesn't run
      // the session-expired redirect on public pages.
      const data = await httpClient.get<never, MeResponseDTO>("/auth/me", {
        skipSessionExpiredRedirect: true,
      });
      return mapToAuthUser(data);
    } catch {
      return null;
    }
  }

  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    const data = await httpClient.put<never, MeResponseDTO>("/auth/profile", input);
    return mapToAuthUser(data);
  }

  async uploadAvatar(file: File): Promise<AuthUser> {
    const formData = new FormData();
    formData.append("file", file);

    const data = await httpClient.put<never, MeResponseDTO>("/auth/profile/avatar", formData);
    return mapToAuthUser(data);
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    await httpClient.post("/auth/password/request-reset", { email: input.email });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await httpClient.post("/auth/password/reset", {
      token: input.token,
      password: input.password,
    });
  }
}
