import { useCallback, useEffect, useRef } from "react";
import { Flex, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { SaveButton } from "@/shared/components/ui/SaveButton";
import { FormField } from "@/shared/components/forms/FormField";
import { useDetailPageController } from "@/shared/hooks/useDetailPageController";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useUpdateDeviceWebhooks } from "@/modules/devices/presentation/hooks/useDevices";
import type {
  Device,
  DeviceWebhooks,
  UpdateDeviceWebhooksInput,
} from "@/modules/devices/domain/entities/Device";

type WebhooksForm = Record<keyof DeviceWebhooks, string>;

const FIELDS: (keyof DeviceWebhooks)[] = [
  "onConnect",
  "onDisconnect",
  "onMessageStatus",
  "onSend",
  "onReceive",
];

function seed(webhooks: DeviceWebhooks): WebhooksForm {
  return {
    onConnect: webhooks.onConnect ?? "",
    onDisconnect: webhooks.onDisconnect ?? "",
    onReceive: webhooks.onReceive ?? "",
    onMessageStatus: webhooks.onMessageStatus ?? "",
    onSend: webhooks.onSend ?? "",
  };
}

const isHttpUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value.trim());

// Empty string clears the hook (→ null); otherwise send the trimmed URL.
const toPayloadValue = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

interface DeviceWebhooksSectionProps {
  device: Device;
}

/**
 * Per-event webhook URLs with autosave (1500ms debounce). `onReceive` is
 * persisted but dormant in this version (no inbound event fires it) — its
 * helper text says so.
 */
export function DeviceWebhooksSection({ device }: DeviceWebhooksSectionProps) {
  const { t } = useTranslation("devices");
  const updateWebhooks = useUpdateDeviceWebhooks(device.id);

  const handleSave = useCallback(
    async (data: WebhooksForm) => {
      const payload: UpdateDeviceWebhooksInput = {
        onConnect: toPayloadValue(data.onConnect),
        onDisconnect: toPayloadValue(data.onDisconnect),
        onReceive: toPayloadValue(data.onReceive),
        onMessageStatus: toPayloadValue(data.onMessageStatus),
        onSend: toPayloadValue(data.onSend),
      };
      await updateWebhooks.mutateAsync(payload);
    },
    [updateWebhooks],
  );

  const {
    localData,
    isDirty,
    isSaving,
    errors,
    handleFieldChange,
    handleManualSave,
    reset,
  } = useDetailPageController<WebhooksForm>({
    onSave: handleSave,
    delay: 1500,
    flushOnUnmount: true,
    autoSaveMessage: t("webhooks.saved"),
    validationSchema: {
      onConnect: (v) => (v === "" || isHttpUrl(v) ? null : "invalid_url"),
      onDisconnect: (v) => (v === "" || isHttpUrl(v) ? null : "invalid_url"),
      onReceive: (v) => (v === "" || isHttpUrl(v) ? null : "invalid_url"),
      onMessageStatus: (v) => (v === "" || isHttpUrl(v) ? null : "invalid_url"),
      onSend: (v) => (v === "" || isHttpUrl(v) ? null : "invalid_url"),
    },
  });
  useUnsavedChangesGuard(isDirty);

  // Seed from the device exactly once (autosave owns the state afterwards).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    reset(seed(device.webhooks));
    seededRef.current = true;
  }, [device.webhooks, reset]);

  return (
    <SectionCard>
      <Text fontSize="sm" fontWeight="600" color="text.primary" mb={1}>
        {t("webhooks.title")}
      </Text>
      <Text fontSize="xs" color="text.secondary" mb={4}>
        {t("webhooks.description")}
      </Text>

      <Stack gap={4}>
        {FIELDS.map((field) => (
          <FormField
            key={field}
            label={t(`webhooks.${field}`)}
            placeholder="https://"
            value={localData[field] ?? ""}
            onChange={(value) => handleFieldChange(field, value)}
            error={errors[field] ? t("webhooks.errors.invalid_url") : undefined}
            helperText={
              field === "onReceive" ? t("webhooks.onReceiveDormant") : undefined
            }
          />
        ))}
      </Stack>

      <Flex justify="flex-end" mt={4}>
        <SaveButton
          isDirty={isDirty}
          isSaving={isSaving}
          onClick={handleManualSave}
        />
      </Flex>
    </SectionCard>
  );
}
