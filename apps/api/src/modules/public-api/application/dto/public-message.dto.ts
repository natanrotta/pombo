import { z } from "zod";
import {
  imageBody,
  audioBody,
  videoBody,
  documentBody,
} from "@modules/messaging/application/dto/message.dto";

// E.164: an optional leading +, a non-zero first digit, 8–15 digits total.
const E164 = /^\+?[1-9]\d{7,14}$/;

const phone = z
  .string()
  .trim()
  .regex(E164, "phone must be in E.164 format (e.g. 5548999999999)");

export const SendTextPublicDTOSchema = z.object({
  phone,
  message: z.string().trim().min(1).max(4096),
});

// Rich sends share the internal payload shapes (Z-API parity) — only the phone
// rule differs (E.164 on the public surface).
export const SendImagePublicDTOSchema = z.object({ phone, ...imageBody });
export const SendAudioPublicDTOSchema = z.object({ phone, ...audioBody });
export const SendVideoPublicDTOSchema = z.object({ phone, ...videoBody });
export const SendDocumentPublicDTOSchema = z.object({ phone, ...documentBody });

export const PublicDeviceIdParamSchema = z.object({
  deviceId: z.string().uuid(),
});

export type SendTextPublicDTO = z.infer<typeof SendTextPublicDTOSchema>;
export type PublicDeviceIdParam = z.infer<typeof PublicDeviceIdParamSchema>;
