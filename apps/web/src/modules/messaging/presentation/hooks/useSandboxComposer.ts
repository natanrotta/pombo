import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorCodes } from "@pombo/shared-types";
import { AppError } from "@/core/errors/AppError";
import { useFormState } from "@/shared/hooks/useFormState";
import { useNotify } from "@/shared/hooks/useNotify";
import { formatPhoneDisplay } from "@/shared/utils/phone";
import type { Device } from "@/modules/devices";
import type {
  SandboxMessageType,
  SendMessageResult,
} from "@/modules/messaging/domain/entities/Message";
import { useSendMessage } from "@/modules/messaging/presentation/hooks/useSendMessage";
import { useRecentRecipients } from "@/modules/messaging/presentation/hooks/useRecentRecipients";
import {
  INITIAL_SANDBOX_FORM,
  PHONE_NOT_ON_WHATSAPP,
  SANDBOX_MESSAGE_TYPES,
  buildSendArgs,
  sandboxValidators,
  type SandboxForm,
} from "@/modules/messaging/presentation/utils/sandboxForm";

/**
 * State and actions of the Sandbox compose card: the form, the device/type
 * options, the burst send and the in-memory queue of its results (each queue
 * row polls its own status).
 */
export function useSandboxComposer(connectedDevices: Device[]) {
  const { t } = useTranslation("sandbox");
  const { showSuccess } = useNotify();
  const { mutateAsync: send } = useSendMessage();
  const { recents, addRecipient, removeRecipient } = useRecentRecipients();

  const [sends, setSends] = useState<SendMessageResult[]>([]);
  const [isSending, setIsSending] = useState(false);

  const form = useFormState<SandboxForm>(
    INITIAL_SANDBOX_FORM,
    sandboxValidators,
  );
  const { formData, errors, setField, setError, reset, validate } = form;

  // Default to the first connected device once the list lands, and re-pick if
  // the selected one drops off the connected set.
  const firstConnectedId = connectedDevices[0]?.id;
  const selectedIsConnected = connectedDevices.some(
    (device) => device.id === formData.deviceId,
  );
  useEffect(() => {
    if (!selectedIsConnected && firstConnectedId) {
      setField("deviceId", firstConnectedId);
    }
  }, [selectedIsConnected, firstConnectedId, setField]);

  const deviceOptions = useMemo(
    () =>
      connectedDevices.map((device) => ({
        value: device.id,
        label: device.identifier
          ? `${device.name} · ${formatPhoneDisplay(device.identifier)}`
          : device.name,
      })),
    [connectedDevices],
  );

  const typeOptions = useMemo(
    () =>
      SANDBOX_MESSAGE_TYPES.map((value) => ({
        value,
        label: t(`type.${value}`),
      })),
    [t],
  );

  // Keeps device, phone and count; clears the type-specific fields.
  const { deviceId, phone, count } = formData;
  const handleTypeChange = useCallback(
    (value: string) =>
      reset({
        ...INITIAL_SANDBOX_FORM,
        deviceId,
        phone,
        count,
        // Only offered values reach here (the select's options).
        messageType: value as SandboxMessageType,
      }),
    [reset, deviceId, phone, count],
  );

  const handleReset = useCallback(() => {
    reset({ ...INITIAL_SANDBOX_FORM, deviceId });
    setSends([]);
  }, [reset, deviceId]);

  // Enqueue the burst SEQUENTIALLY, revealing each row as it lands so the queue
  // grows live. Abort on the first failure: every message targets the same
  // device/recipient, so a failure (offline, not on WhatsApp) repeats — one
  // toast (the mutation's onError) beats N. The drain does the real pacing.
  const handleSend = useCallback(async () => {
    if (!validate()) return;
    const total = formData.count;
    setSends([]);
    setIsSending(true);
    const collected: SendMessageResult[] = [];
    try {
      for (let index = 1; index <= total; index++) {
        collected.push(await send(buildSendArgs(formData, index, total)));
        setSends([...collected]);
      }
    } catch (error) {
      // Already toasted by the mutation; also pin the rejected recipient on
      // its field. Rows enqueued so far stay observable.
      if (
        formData.messageType !== "group" &&
        error instanceof AppError &&
        error.code === ErrorCodes.NUMBER_NOT_ON_WHATSAPP
      ) {
        setError("phone", PHONE_NOT_ON_WHATSAPP);
      }
    } finally {
      setIsSending(false);
    }
    if (collected.length > 0) {
      // Recents are phone-keyed — a group send has no phone to remember.
      if (formData.messageType !== "group") addRecipient(formData.phone);
      showSuccess(t("success", { total: collected.length }));
    }
  }, [validate, formData, send, setError, addRecipient, showSuccess, t]);

  return {
    formData,
    errors,
    setField,
    deviceOptions,
    typeOptions,
    recents,
    removeRecipient,
    sends,
    isSending,
    handleTypeChange,
    handleReset,
    handleSend,
  };
}

export type SandboxComposerState = ReturnType<typeof useSandboxComposer>;
