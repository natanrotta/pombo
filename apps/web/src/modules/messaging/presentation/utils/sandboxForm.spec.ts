import { describe, expect, it } from "vitest";
import {
  INITIAL_SANDBOX_FORM,
  MAX_BURST,
  buildSendArgs,
  clampCount,
  isMediaType,
  sandboxValidators,
  type SandboxForm,
} from "./sandboxForm";

const formWith = (overrides: Partial<SandboxForm> = {}): SandboxForm => ({
  ...INITIAL_SANDBOX_FORM,
  deviceId: "device-1",
  ...overrides,
});

/** Runs the schema's validator for `field` against `form` (the value under
 *  test is the form's own value, exactly as `useFormState.validate` does). */
function validateField<K extends keyof SandboxForm>(
  field: K,
  form: SandboxForm,
): string | null {
  const validator = sandboxValidators[field];
  if (!validator) throw new Error(`no validator for ${String(field)}`);
  return validator(form[field], form);
}

const MEDIA_TYPES = ["image", "audio", "video", "document"] as const;

describe("clampCount", () => {
  it("keeps values inside the 1..MAX_BURST range untouched", () => {
    expect(clampCount(1)).toBe(1);
    expect(clampCount(7)).toBe(7);
    expect(clampCount(MAX_BURST)).toBe(MAX_BURST);
  });

  it("raises zero and negative values to 1", () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(-5)).toBe(1);
  });

  it("caps values above the burst ceiling at MAX_BURST", () => {
    expect(clampCount(MAX_BURST + 1)).toBe(MAX_BURST);
    expect(clampCount(500)).toBe(MAX_BURST);
    expect(clampCount(Number.POSITIVE_INFINITY)).toBe(MAX_BURST);
  });

  it("rounds fractional values to the nearest integer", () => {
    expect(clampCount(2.4)).toBe(2);
    expect(clampCount(2.5)).toBe(3);
    expect(clampCount(0.4)).toBe(1);
  });

  it("falls back to 1 for NaN (an emptied number input)", () => {
    expect(clampCount(Number.NaN)).toBe(1);
  });
});

describe("isMediaType", () => {
  it.each(MEDIA_TYPES)("treats %s as a media type", (type) => {
    expect(isMediaType(type)).toBe(true);
  });

  it.each(["text", "group"] as const)("does not treat %s as media", (type) => {
    expect(isMediaType(type)).toBe(false);
  });
});

describe("sandboxValidators", () => {
  describe("deviceId", () => {
    it("requires a device", () => {
      expect(validateField("deviceId", formWith({ deviceId: "" }))).toBe(
        "required",
      );
    });

    it("accepts a selected device", () => {
      expect(validateField("deviceId", formWith())).toBeNull();
    });
  });

  describe("phone", () => {
    it("rejects a number with fewer than 10 digits", () => {
      expect(
        validateField("phone", formWith({ phone: "(11) 9999-999" })),
      ).toBe("invalid");
    });

    it("rejects an empty number on a phone-targeted send", () => {
      expect(
        validateField("phone", formWith({ messageType: "image", phone: "" })),
      ).toBe("invalid");
    });

    it("accepts a masked number once it has at least 10 digits", () => {
      expect(
        validateField("phone", formWith({ phone: "(11) 9999-8888" })),
      ).toBeNull();
      expect(
        validateField("phone", formWith({ phone: "+55 (11) 99999-8888" })),
      ).toBeNull();
    });

    it("skips the phone check for a group send", () => {
      expect(
        validateField("phone", formWith({ messageType: "group", phone: "" })),
      ).toBeNull();
    });
  });

  describe("groupJid", () => {
    it("requires a group only for the group type", () => {
      expect(
        validateField(
          "groupJid",
          formWith({ messageType: "group", groupJid: "" }),
        ),
      ).toBe("required");
    });

    it("accepts a chosen group on a group send", () => {
      expect(
        validateField(
          "groupJid",
          formWith({ messageType: "group", groupJid: "123-456@g.us" }),
        ),
      ).toBeNull();
    });

    it.each(["text", ...MEDIA_TYPES] as const)(
      "ignores an empty group on a %s send",
      (messageType) => {
        expect(
          validateField("groupJid", formWith({ messageType, groupJid: "" })),
        ).toBeNull();
      },
    );
  });

  describe("text", () => {
    it.each(["text", "group"] as const)(
      "requires non-blank text on a %s send",
      (messageType) => {
        expect(validateField("text", formWith({ messageType, text: "" }))).toBe(
          "required",
        );
        expect(
          validateField("text", formWith({ messageType, text: "   " })),
        ).toBe("required");
      },
    );

    it.each(["text", "group"] as const)(
      "accepts text on a %s send",
      (messageType) => {
        expect(
          validateField("text", formWith({ messageType, text: "Olá" })),
        ).toBeNull();
      },
    );

    it.each(MEDIA_TYPES)("ignores empty text on a %s send", (messageType) => {
      expect(
        validateField("text", formWith({ messageType, text: "" })),
      ).toBeNull();
    });
  });

  describe("mediaUrl", () => {
    it.each(MEDIA_TYPES)(
      "requires a non-blank media URL on a %s send",
      (messageType) => {
        expect(
          validateField("mediaUrl", formWith({ messageType, mediaUrl: "" })),
        ).toBe("required");
        expect(
          validateField("mediaUrl", formWith({ messageType, mediaUrl: "  " })),
        ).toBe("required");
      },
    );

    it.each(MEDIA_TYPES)("accepts a media URL on a %s send", (messageType) => {
      expect(
        validateField(
          "mediaUrl",
          formWith({ messageType, mediaUrl: "https://cdn.test/file" }),
        ),
      ).toBeNull();
    });

    it.each(["text", "group"] as const)(
      "ignores an empty media URL on a %s send",
      (messageType) => {
        expect(
          validateField("mediaUrl", formWith({ messageType, mediaUrl: "" })),
        ).toBeNull();
      },
    );
  });

  describe("count", () => {
    it("accepts the bounds of the burst range", () => {
      expect(validateField("count", formWith({ count: 1 }))).toBeNull();
      expect(validateField("count", formWith({ count: MAX_BURST }))).toBeNull();
    });

    it("rejects values outside the burst range", () => {
      expect(validateField("count", formWith({ count: 0 }))).toBe("invalid");
      expect(validateField("count", formWith({ count: MAX_BURST + 1 }))).toBe(
        "invalid",
      );
    });
  });
});

describe("buildSendArgs", () => {
  const PHONE = "+55 (11) 99999-8888";
  const PHONE_DIGITS = "5511999998888";

  describe("text", () => {
    const form = formWith({ phone: PHONE, text: "  Olá mundo  " });

    it("sends the trimmed text to the unformatted phone", () => {
      expect(buildSendArgs(form, 1, 1)).toStrictEqual({
        deviceId: "device-1",
        type: "text",
        input: { phone: PHONE_DIGITS, text: "Olá mundo" },
      });
    });

    it("appends the (i/N) suffix inside a real burst", () => {
      expect(buildSendArgs(form, 2, 3)).toStrictEqual({
        deviceId: "device-1",
        type: "text",
        input: { phone: PHONE_DIGITS, text: "Olá mundo (2/3)" },
      });
    });
  });

  describe("group", () => {
    const form = formWith({
      messageType: "group",
      phone: PHONE,
      groupJid: "123-456@g.us",
      text: " Oi grupo ",
    });

    it("targets the group JID and carries no phone", () => {
      expect(buildSendArgs(form, 1, 1)).toStrictEqual({
        deviceId: "device-1",
        type: "group",
        input: { groupJid: "123-456@g.us", text: "Oi grupo" },
      });
    });

    it("appends the (i/N) suffix inside a real burst", () => {
      expect(buildSendArgs(form, 3, 4)).toStrictEqual({
        deviceId: "device-1",
        type: "group",
        input: { groupJid: "123-456@g.us", text: "Oi grupo (3/4)" },
      });
    });
  });

  describe("image", () => {
    it("sends the trimmed URL and caption, unchanged by the burst index", () => {
      const form = formWith({
        messageType: "image",
        phone: PHONE,
        mediaUrl: " https://cdn.test/a.png ",
        caption: " Foto ",
      });

      expect(buildSendArgs(form, 2, 5)).toStrictEqual({
        deviceId: "device-1",
        type: "image",
        input: {
          phone: PHONE_DIGITS,
          image: "https://cdn.test/a.png",
          caption: "Foto",
        },
      });
    });

    it("drops a blank caption", () => {
      const form = formWith({
        messageType: "image",
        phone: PHONE,
        mediaUrl: "https://cdn.test/a.png",
        caption: "   ",
      });

      expect(buildSendArgs(form, 1, 1).input).toStrictEqual({
        phone: PHONE_DIGITS,
        image: "https://cdn.test/a.png",
        caption: undefined,
      });
    });
  });

  describe("audio", () => {
    it("sends only the phone and the trimmed URL, ignoring caption and burst index", () => {
      const form = formWith({
        messageType: "audio",
        phone: PHONE,
        mediaUrl: " https://cdn.test/a.ogg ",
        caption: "stale caption",
        text: "stale text",
      });

      expect(buildSendArgs(form, 1, 3)).toStrictEqual({
        deviceId: "device-1",
        type: "audio",
        input: { phone: PHONE_DIGITS, audio: "https://cdn.test/a.ogg" },
      });
    });
  });

  describe("video", () => {
    it("sends the trimmed URL and caption", () => {
      const form = formWith({
        messageType: "video",
        phone: PHONE,
        mediaUrl: " https://cdn.test/a.mp4 ",
        caption: " Vídeo ",
      });

      expect(buildSendArgs(form, 3, 3)).toStrictEqual({
        deviceId: "device-1",
        type: "video",
        input: {
          phone: PHONE_DIGITS,
          video: "https://cdn.test/a.mp4",
          caption: "Vídeo",
        },
      });
    });

    it("drops a blank caption", () => {
      const form = formWith({
        messageType: "video",
        phone: PHONE,
        mediaUrl: "https://cdn.test/a.mp4",
        caption: "",
      });

      expect(buildSendArgs(form, 1, 1).input).toStrictEqual({
        phone: PHONE_DIGITS,
        video: "https://cdn.test/a.mp4",
        caption: undefined,
      });
    });
  });

  describe("document", () => {
    it("sends the trimmed URL, file name and caption", () => {
      const form = formWith({
        messageType: "document",
        phone: PHONE,
        mediaUrl: " https://cdn.test/a.pdf ",
        fileName: " contrato.pdf ",
        caption: " Segue ",
      });

      expect(buildSendArgs(form, 1, 2)).toStrictEqual({
        deviceId: "device-1",
        type: "document",
        input: {
          phone: PHONE_DIGITS,
          document: "https://cdn.test/a.pdf",
          fileName: "contrato.pdf",
          caption: "Segue",
        },
      });
    });

    it("drops a blank file name and caption", () => {
      const form = formWith({
        messageType: "document",
        phone: PHONE,
        mediaUrl: "https://cdn.test/a.pdf",
        fileName: "  ",
        caption: "  ",
      });

      expect(buildSendArgs(form, 1, 1).input).toStrictEqual({
        phone: PHONE_DIGITS,
        document: "https://cdn.test/a.pdf",
        fileName: undefined,
        caption: undefined,
      });
    });
  });
});
