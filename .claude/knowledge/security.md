# Security — Accumulated Knowledge (living)

> Living notes for the `/security` skill + `security-auditor`: principles and open risks discovered with use.
> Authority for the model + `SEC-*` catalog stays in `.claude/patterns/security.md`.

## Principles
- Fail closed: cross-tenant access returns `NotFoundError` (404), never `ForbiddenError` (403).
- Reuse the existing secure primitive (scoped repository signatures, `validateRequest`, the limiters, JWT/bcrypt providers, the hashed `pmb_` tokens, `AesGcmEncryptionService`, the HMAC webhook signer, the pino `redact` list) instead of inventing crypto.
- The WhatsApp session keys (`auth_key`) are the crown jewels: never logged, never exported, wiped on logout, cascade-deleted with the device, inside the encrypted backup.

## Open risks / backlog
- (none yet)
