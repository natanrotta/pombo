import { beforeAll, describe, expect, it } from "vitest";
import type { ZodError } from "zod";
import i18n from "@/shared/i18n";
import authPtBR from "@/shared/i18n/locales/pt-BR/auth.json";
import {
  buildForgotPasswordSchema,
  buildResetPasswordSchema,
} from "./schemas";

// The builders read i18n when called, so the expected copy is the pt-BR JSON
// itself — never a hardcoded duplicate that could drift from the locale.
const forgotCopy = authPtBR.forgotPassword;
const resetCopy = authPtBR.resetPassword;

const STRONG_PASSWORD = "Senha@123";

function issuesFor(error: ZodError, field: string) {
  return error.issues.filter((issue) => issue.path.join(".") === field);
}

beforeAll(async () => {
  if (i18n.language !== "pt-BR") await i18n.changeLanguage("pt-BR");
});

describe("buildForgotPasswordSchema", () => {
  it.each([
    ["an empty", ""],
    ["a whitespace-only", "   "],
    ["a truncated", "ana@"],
    ["a dotless-domain", "ana@test"],
    ["an @-less", "ana.test.com"],
  ])("rejects %s e-mail with the forgot-password message", (_label, email) => {
    const result = buildForgotPasswordSchema().safeParse({ email });

    expect(result.success).toBe(false);
    if (result.success) return;
    const emailIssues = issuesFor(result.error, "email");
    expect(emailIssues.length).toBeGreaterThan(0);
    expect(emailIssues[0]?.message).toBe(forgotCopy.emailRequired);
  });

  it("accepts a valid e-mail and returns it trimmed", () => {
    const result = buildForgotPasswordSchema().safeParse({
      email: "  ana@test.com  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("ana@test.com");
  });
});

describe("buildResetPasswordSchema", () => {
  it("reports the required message first for an empty password", () => {
    const result = buildResetPasswordSchema().safeParse({
      password: "",
      confirm: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const passwordIssues = issuesFor(result.error, "password");
    // Form resolvers surface the first issue per field: "required" must win
    // over "weak" for an empty value.
    expect(passwordIssues[0]?.message).toBe(resetCopy.passwordRequired);
  });

  it.each([
    ["too short", "Ab@1"],
    ["missing an uppercase letter", "senha@123"],
    ["missing a lowercase letter", "SENHA@123"],
    ["missing a digit", "Senha@abc"],
    ["missing a symbol", "Senha1234"],
  ])("rejects a password %s with the weak message", (_label, password) => {
    const result = buildResetPasswordSchema().safeParse({
      password,
      confirm: password,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const passwordIssues = issuesFor(result.error, "password");
    expect(passwordIssues.map((issue) => issue.message)).toEqual([
      resetCopy.passwordWeak,
    ]);
    expect(issuesFor(result.error, "confirm")).toHaveLength(0);
  });

  it("flags a confirmation mismatch on the confirm field only", () => {
    const result = buildResetPasswordSchema().safeParse({
      password: STRONG_PASSWORD,
      confirm: `${STRONG_PASSWORD}x`,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]?.path).toEqual(["confirm"]);
    expect(result.error.issues[0]?.message).toBe(resetCopy.confirmMismatch);
  });

  it("accepts a strong password that matches its confirmation", () => {
    const result = buildResetPasswordSchema().safeParse({
      password: STRONG_PASSWORD,
      confirm: STRONG_PASSWORD,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      password: STRONG_PASSWORD,
      confirm: STRONG_PASSWORD,
    });
  });
});
