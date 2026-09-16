/**
 * Lifecycle of a `user` row. Mirrors the Prisma `user_status` enum so the
 * entity, the repositories and the wire DTO speak the same vocabulary.
 *
 * Only an ACTIVE user may hold a session: sign-in, Google sign-in, refresh and
 * password-reset all gate on `User.isActive` and answer with the generic
 * AUTH_INVALID_CREDENTIALS — never a hint about WHY the account is refused.
 */
export type UserStatus = "ACTIVE" | "PENDING";
