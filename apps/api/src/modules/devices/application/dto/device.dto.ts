import { z } from "zod";

export const RegisterDeviceDTOSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

// An http(s) URL, or null to clear the hook. Absent key = leave unchanged.
const webhookUrlField = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//i.test(v), {
    message: "Webhook URL must use http(s)",
  })
  .nullable()
  .optional();

export const UpdateDeviceWebhooksDTOSchema = z
  .object({
    onConnect: webhookUrlField,
    onDisconnect: webhookUrlField,
    onReceive: webhookUrlField,
    onMessageStatus: webhookUrlField,
    onSend: webhookUrlField,
  })
  .strict();

export type RegisterDeviceDTO = z.infer<typeof RegisterDeviceDTOSchema>;
export type UpdateDeviceWebhooksDTO = z.infer<
  typeof UpdateDeviceWebhooksDTOSchema
>;

/** Returned exactly once at registration — carries the one-time webhookSecret. */
export interface RegisterDeviceResponseDTO {
  id: string;
  webhookSecret: string;
}
