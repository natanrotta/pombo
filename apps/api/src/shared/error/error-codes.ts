/**
 * The wire error-code catalog lives in the shared contract
 * (`@pombo/shared-types`) so the API and the web branch on the same values.
 * `error-codes.spec.ts` pins the locale parity: adding a code there means
 * adding its message to `i18n/locales/{pt-BR,en,es}/errors.json`.
 */
export { ErrorCodes } from "@pombo/shared-types";
export type { ErrorCode } from "@pombo/shared-types";
