// The WhatsApp individual-user server suffix. A user JID is `<digits>@<server>`.
const USER_SERVER = "s.whatsapp.net";
// The WhatsApp group server suffix. A group JID is `<groupId>@g.us`.
const GROUP_SERVER = "g.us";

/**
 * Build the canonical WhatsApp user JID from a phone number.
 *
 * Used to enqueue a send while the device is OFFLINE: we can't call
 * `onWhatsApp` to resolve/validate the JID with no live socket, so we construct
 * it and defer the "is on WhatsApp?" check to drain time. Strips any mask
 * (spaces, `+`, `()`, `-`) so `+55 (11) 99999-9999` → `5511999999999@s.whatsapp.net`.
 */
export const buildUserJid = (phone: string): string =>
  `${phone.replace(/\D/g, "")}@${USER_SERVER}`;

/** Recover the phone (digits) from a user JID — for the `message.sent` event,
 *  which carries the phone, not the JID. */
export const userJidToPhone = (jid: string): string => jid.split("@")[0] ?? "";

/** True when the JID addresses a WhatsApp group (`<groupId>@g.us`) rather than
 *  an individual user. Group JIDs are canonical and must skip `resolveJid` (the
 *  `onWhatsApp` lookup is user-only). */
export const isGroupJid = (jid: string): boolean =>
  jid.endsWith(`@${GROUP_SERVER}`);

/**
 * Normalize a group identifier into a canonical group JID. If it already carries
 * the `@g.us` suffix it is returned as-is; a bare id gets the suffix appended.
 * Unlike `buildUserJid`, characters are NOT stripped — group ids can contain a
 * hyphen (legacy `<creator>-<timestamp>` ids), so only the surrounding
 * whitespace is trimmed. This is a defensive normalizer, not a validator — the
 * caller passes a pre-validated JID (`SendGroupMessageDTOSchema` is the gate).
 */
export const buildGroupJid = (groupId: string): string =>
  isGroupJid(groupId) ? groupId : `${groupId.trim()}@${GROUP_SERVER}`;
