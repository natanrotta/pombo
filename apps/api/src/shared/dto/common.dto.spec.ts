import { UuidParamSchema } from "./common.dto";

describe("UuidParamSchema", () => {
  it("accepts a UUID id", () => {
    const id = "2f1c4b8e-7d9a-4c3e-9f0b-1a2b3c4d5e6f";
    expect(UuidParamSchema.parse({ id }).id).toBe(id);
  });

  it("rejects a non-UUID id with the plain `uuid` validation (no custom message — the i18n error map owns the text)", () => {
    const result = UuidParamSchema.safeParse({ id: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0]!;
      expect(issue.code).toBe("invalid_string");
      expect(issue).toMatchObject({ validation: "uuid" });
      expect(issue.message).toBe("Invalid uuid");
    }
  });

  it("rejects a missing id", () => {
    expect(UuidParamSchema.safeParse({}).success).toBe(false);
  });
});
