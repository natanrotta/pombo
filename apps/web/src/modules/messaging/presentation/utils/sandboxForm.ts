import type { ValidationSchema } from "@/shared/hooks/useFormState";
import { unformatPhone } from "@/shared/utils/phone";
import type { SandboxMessageType } from "@/modules/messaging/domain/entities/Message";
import type { SendMessageArgs } from "@/modules/messaging/presentation/hooks/useSendMessage";

/** Burst ceiling — enough to watch the queue drain with pacing, without letting
 *  a stray value fire hundreds of real WhatsApp sends. */
export const MAX_BURST = 20;

export const SANDBOX_MESSAGE_TYPES: readonly SandboxMessageType[] = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "group",
];

type MediaMessageType = "image" | "audio" | "video" | "document";

const MEDIA_TYPES: ReadonlySet<SandboxMessageType> = new Set<MediaMessageType>([
  "image",
  "audio",
  "video",
  "document",
]);

export const isMediaType = (
  type: SandboxMessageType,
): type is MediaMessageType => MEDIA_TYPES.has(type);

export const clampCount = (value: number): number =>
  Math.max(1, Math.min(MAX_BURST, Math.round(value) || 1));

export type SandboxForm = {
  deviceId: string;
  messageType: SandboxMessageType;
  phone: string;
  /** Group recipient JID (`<id>@g.us`) — active only for the "group" type. */
  groupJid: string;
  text: string;
  /** Shared across the four media types (only one is active at a time). */
  mediaUrl: string;
  caption: string;
  fileName: string;
  /** How many messages to enqueue in one send — the burst that exercises the
   *  drain's humanized pacing (typing + jitter + long pauses). */
  count: number;
};

/** The fields that belong to one message type; reset (via the initial form)
 *  on every type switch so a stale value can never ride along on a send. */
const EMPTY_TYPE_FIELDS = {
  groupJid: "",
  text: "",
  mediaUrl: "",
  caption: "",
  fileName: "",
} satisfies Partial<SandboxForm>;

export const INITIAL_SANDBOX_FORM: SandboxForm = {
  deviceId: "",
  messageType: "text",
  phone: "",
  count: 1,
  ...EMPTY_TYPE_FIELDS,
};

/** Error code set on `phone` when the API says the number isn't on WhatsApp. */
export const PHONE_NOT_ON_WHATSAPP = "notOnWhatsApp";

export const sandboxValidators: ValidationSchema<SandboxForm> = {
  deviceId: (value) => (value ? null : "required"),
  // A group send has no phone (it targets `groupJid`).
  phone: (value, form) =>
    form.messageType === "group" || unformatPhone(value).length >= 10
      ? null
      : "invalid",
  groupJid: (value, form) =>
    form.messageType !== "group" || value ? null : "required",
  text: (value, form) =>
    (form.messageType !== "text" && form.messageType !== "group") ||
    value.trim()
      ? null
      : "required",
  mediaUrl: (value, form) =>
    !isMediaType(form.messageType) || value.trim() ? null : "required",
  count: (value) => (value >= 1 && value <= MAX_BURST ? null : "invalid"),
};

/**
 * Send args for message `index` of a burst of `total`. Text and group sends get
 * an `(i/N)` suffix in a real burst, so the messages are distinguishable AND
 * their typing windows vary by length; media payloads ride unchanged.
 */
export function buildSendArgs(
  form: SandboxForm,
  index: number,
  total: number,
): SendMessageArgs {
  const { deviceId } = form;
  const phone = unformatPhone(form.phone);
  const caption = form.caption.trim() || undefined;
  const text = form.text.trim() + (total > 1 ? ` (${index}/${total})` : "");
  const media = form.mediaUrl.trim();

  switch (form.messageType) {
    case "text":
      return { deviceId, type: "text", input: { phone, text } };
    case "group":
      return { deviceId, type: "group", input: { groupJid: form.groupJid, text } };
    case "image":
      return { deviceId, type: "image", input: { phone, image: media, caption } };
    case "audio":
      return { deviceId, type: "audio", input: { phone, audio: media } };
    case "video":
      return { deviceId, type: "video", input: { phone, video: media, caption } };
    case "document":
      return {
        deviceId,
        type: "document",
        input: {
          phone,
          document: media,
          fileName: form.fileName.trim() || undefined,
          caption,
        },
      };
  }
}
