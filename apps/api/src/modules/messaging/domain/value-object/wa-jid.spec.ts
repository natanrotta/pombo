import {
  buildUserJid,
  userJidToPhone,
  isGroupJid,
  buildGroupJid,
} from "./wa-jid";

describe("buildUserJid", () => {
  it("builds a canonical user JID from bare digits", () => {
    expect(buildUserJid("5511999999999")).toBe("5511999999999@s.whatsapp.net");
  });

  it("strips any phone mask (+, spaces, parens, dashes)", () => {
    expect(buildUserJid("+55 (11) 99999-9999")).toBe(
      "5511999999999@s.whatsapp.net",
    );
  });
});

describe("userJidToPhone", () => {
  it("recovers the phone digits from a user JID", () => {
    expect(userJidToPhone("5511999999999@s.whatsapp.net")).toBe(
      "5511999999999",
    );
  });

  it("round-trips with buildUserJid", () => {
    const phone = "5511999999999";
    expect(userJidToPhone(buildUserJid(phone))).toBe(phone);
  });
});

describe("isGroupJid", () => {
  it("is true for a group JID (@g.us)", () => {
    expect(isGroupJid("120363000000000001@g.us")).toBe(true);
  });

  it("is false for a user JID (@s.whatsapp.net)", () => {
    expect(isGroupJid("5511999999999@s.whatsapp.net")).toBe(false);
  });
});

describe("buildGroupJid", () => {
  it("returns an already-canonical group JID unchanged", () => {
    expect(buildGroupJid("120363000000000001@g.us")).toBe(
      "120363000000000001@g.us",
    );
  });

  it("appends the @g.us suffix to a bare group id", () => {
    expect(buildGroupJid("120363000000000001")).toBe("120363000000000001@g.us");
  });

  it("preserves a hyphen in a legacy group id (no stripping)", () => {
    expect(buildGroupJid("5511999999999-1600000000")).toBe(
      "5511999999999-1600000000@g.us",
    );
  });
});
