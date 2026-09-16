/**
 * JWT capability scope on the short-lived token issued at e-mail+password
 * sign-up. The token ONLY authorizes the send/verify-PIN endpoints. Shared
 * across the boundary so the API mints/gates it and the web client can
 * recognise it in the decoded claim — single source of truth, no drift.
 */
export const EMAIL_VERIFY_JWT_SCOPE = "email:verify" as const;

// ------------------------------------------------------------------
// Wire format note
// ------------------------------------------------------------------
// Every Date field in a Response DTO is declared as `string` (ISO-8601)
// because that's what actually goes over the wire — Express's `res.json`
// serializes Date instances to ISO strings, and the web client deserializes
// them as strings. The API entity may store these internally as `Date` but
// `toJSON()` is responsible for emitting the ISO string so the typed
// contract matches the runtime payload.
// ------------------------------------------------------------------

/** Lifecycle of a `user` row. */
export type UserStatus = "ACTIVE" | "PENDING";

/**
 * `GET /auth/me` response — the authenticated user's profile. Single-user
 * boilerplate: no accounts, memberships, roles, subscriptions or onboarding.
 */
export interface MeResponseDTO {
  id: string;
  name: string;
  email: string;
  /** Whether the user confirmed control of their e-mail. `false` only for an
   *  email+password account mid-PIN-confirmation; Google sign-ins are always
   *  `true`. */
  emailVerified: boolean;
  avatarUrl: string | null;
  language: string;
  status: UserStatus;
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601. */
  updatedAt: string;
}

/**
 * Body of every endpoint that mints a full session (`sign-in`,
 * `email-verification/verify`). The session itself rides httpOnly cookies;
 * `token` is echoed for non-browser clients (the web ignores it) and
 * `csrfToken` is the value of the JS-readable `pombo_csrf` cookie. The refresh
 * token is never in the body — it lives only in the `pombo_rt` cookie.
 */
export interface SessionResponseDTO {
  user: MeResponseDTO;
  token: string;
  csrfToken: string;
}

/** `POST /auth/sign-in` response — single-user, so the session is final
 *  immediately (no account picker). */
export type SignInResponseDTO = SessionResponseDTO;

/** `POST /auth/email-verification/verify` response — the PIN upgrades the
 *  scoped token into a full session. */
export type VerifyEmailPinResponseDTO = SessionResponseDTO;

/**
 * `POST /auth/sign-up` response (email+password path). The user is created
 * unverified — instead of a full session the backend returns a short-lived
 * `email:verify`-scoped token and the registered e-mail. The FE stores the
 * token and routes to `/verify-email`, where the user confirms the 6-digit
 * PIN to upgrade into a full session. `csrfToken` lets the scoped POSTs pass
 * the double-submit check before any session exists.
 */
export interface SignUpResponseDTO {
  requiresEmailVerification: true;
  /** Scoped JWT that ONLY authorizes the send/verify-PIN endpoints. */
  token: string;
  email: string;
  csrfToken: string;
}

/**
 * `POST /auth/google` response (200 on sign-in, 201 on sign-up). Both land on
 * a full session; `kind` lets the FE pick the post-auth route.
 */
export type GoogleSignInResponseDTO = { kind: "sign-in" | "sign-up" } & SessionResponseDTO;

/** `POST /auth/refresh` response. The rotated refresh token goes to the
 *  cookie only. */
export interface RefreshTokenResponseDTO {
  token: string;
  csrfToken: string;
}
