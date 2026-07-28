import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Flex, Icon, SimpleGrid } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiSend } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ListPageSkeleton } from "@/shared/components/skeletons/ListPageSkeleton";
import { SelectField } from "@/shared/components/forms/SelectField";
import { FormField } from "@/shared/components/forms/FormField";
import { TextAreaField } from "@/shared/components/forms/TextAreaField";
import { useFormState } from "@/shared/hooks/useFormState";
import { useNotify } from "@/shared/hooks/useNotify";
import { maskPhoneBr, unformatPhone, formatPhoneDisplay } from "@/shared/utils/phone";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useDevicesList, useDeviceGroups } from "@/modules/devices";
import {
  useSendMessage,
  useMessageStatus,
  type SendMessageArgs,
} from "@/modules/messaging/presentation/hooks/useSendMessage";
import { useRecentRecipients } from "@/modules/messaging/presentation/hooks/useRecentRecipients";
import { RecipientNumberField } from "@/modules/messaging/presentation/components/RecipientNumberField";
import { SandboxResult } from "@/modules/messaging/presentation/components/SandboxResult";
import {
  type MessageType,
  type SandboxMessageType,
  type SendMessageResult,
  type MessageStatus,
} from "@/modules/messaging/domain/entities/Message";

const MEDIA_TYPES: readonly MessageType[] = ["image", "audio", "video", "document"];
const MESSAGE_TYPES: readonly SandboxMessageType[] = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "group",
];

const isMedia = (type: string): boolean =>
  MEDIA_TYPES.includes(type as SandboxMessageType as MessageType);

type SandboxForm = {
  deviceId: string;
  messageType: string;
  phone: string;
  /** Group recipient JID (`<id>@g.us`) — active only for the "group" type. */
  groupJid: string;
  text: string;
  /** Shared across the four media types (only one is active at a time). */
  mediaUrl: string;
  caption: string;
  fileName: string;
};

const EMPTY_TYPE_FIELDS = {
  groupJid: "",
  text: "",
  mediaUrl: "",
  caption: "",
  fileName: "",
};

export function SandboxPage() {
  const { t } = useTranslation("sandbox");
  const navigate = useNavigate();
  const { showSuccess } = useNotify();

  const { data: devices = [], isLoading } = useDevicesList();
  const sendMessage = useSendMessage();
  const { recents, addRecipient, removeRecipient } = useRecentRecipients();

  const connectedDevices = useMemo(
    () => devices.filter((d) => d.status === "CONNECTED"),
    [devices],
  );

  const [result, setResult] = useState<SendMessageResult | null>(null);

  // Poll the live delivery status of the last send (stops at READ/FAILED).
  const statusQuery = useMessageStatus(
    result?.messageId ?? null,
    result !== null,
  );
  const liveStatus: MessageStatus | null =
    statusQuery.data?.status ?? result?.status ?? null;
  const failureReason = statusQuery.data?.failureReason ?? null;
  const statusError = statusQuery.isError;
  const isPolling =
    liveStatus !== null &&
    liveStatus !== "READ" &&
    liveStatus !== "FAILED" &&
    !statusError;

  const form = useFormState<SandboxForm>(
    {
      deviceId: "",
      messageType: "text",
      phone: "",
      ...EMPTY_TYPE_FIELDS,
    },
    {
      deviceId: (v) => (v ? null : "required"),
      // The phone field is inactive for a group send (it uses groupJid instead).
      phone: (v, f) =>
        f.messageType === "group"
          ? null
          : unformatPhone(v).length >= 10
            ? null
            : "invalid",
      groupJid: (v, f) =>
        f.messageType === "group" ? (v ? null : "required") : null,
      text: (v, f) =>
        f.messageType === "text" || f.messageType === "group"
          ? v.trim()
            ? null
            : "required"
          : null,
      mediaUrl: (v, f) =>
        isMedia(f.messageType) ? (v.trim() ? null : "required") : null,
    },
  );
  const { setField, reset } = form;
  const { messageType } = form.formData;

  // Default the device select to the first connected device once the list
  // lands, and re-pick if the current one drops off the connected set.
  useEffect(() => {
    const current = form.formData.deviceId;
    const stillConnected = connectedDevices.some((d) => d.id === current);
    if (!stillConnected && connectedDevices.length > 0) {
      setField("deviceId", connectedDevices[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedDevices]);

  const deviceOptions = useMemo(
    () =>
      connectedDevices.map((d) => ({
        value: d.id,
        label: d.identifier
          ? `${d.name} · ${formatPhoneDisplay(d.identifier)}`
          : d.name,
      })),
    [connectedDevices],
  );

  const typeOptions = useMemo(
    () => MESSAGE_TYPES.map((value) => ({ value, label: t(`type.${value}`) })),
    [t],
  );

  // The device's groups feed the recipient picker for the "group" type. Only
  // fetched while that type is active (the backend needs a live socket).
  const groupsQuery = useDeviceGroups(
    form.formData.deviceId,
    messageType === "group",
  );
  const groupOptions = useMemo(
    () =>
      (groupsQuery.data ?? []).map((group) => ({
        value: group.jid,
        label: group.name || group.jid,
      })),
    [groupsQuery.data],
  );
  const groupPlaceholder = groupsQuery.isError
    ? t("fields.groupError")
    : groupsQuery.isLoading
      ? t("fields.groupLoading")
      : groupOptions.length === 0
        ? t("fields.groupEmpty")
        : t("fields.groupPlaceholder");

  // Switching type keeps device + phone, but clears the type-specific fields so
  // a stale value from another type can never ride along on the next send.
  const handleTypeChange = useCallback(
    (value: string) => {
      reset({
        deviceId: form.formData.deviceId,
        phone: form.formData.phone,
        messageType: value,
        ...EMPTY_TYPE_FIELDS,
      });
    },
    [reset, form.formData.deviceId, form.formData.phone],
  );

  const buildArgs = useCallback((): SendMessageArgs => {
    const deviceId = form.formData.deviceId;
    const phone = unformatPhone(form.formData.phone);
    const f = form.formData;
    const caption = f.caption.trim() || undefined;
    switch (f.messageType as SandboxMessageType) {
      case "text":
        return { deviceId, type: "text", input: { phone, text: f.text.trim() } };
      case "group":
        return {
          deviceId,
          type: "group",
          input: { groupJid: f.groupJid, text: f.text.trim() },
        };
      case "image":
        return {
          deviceId,
          type: "image",
          input: { phone, image: f.mediaUrl.trim(), caption },
        };
      case "audio":
        return {
          deviceId,
          type: "audio",
          input: { phone, audio: f.mediaUrl.trim() },
        };
      case "video":
        return {
          deviceId,
          type: "video",
          input: { phone, video: f.mediaUrl.trim(), caption },
        };
      case "document":
        return {
          deviceId,
          type: "document",
          input: {
            phone,
            document: f.mediaUrl.trim(),
            fileName: f.fileName.trim() || undefined,
            caption,
          },
        };
    }
  }, [form.formData]);

  const handleSend = useCallback(async () => {
    if (!form.validate()) return;
    const args = buildArgs();
    try {
      const res = await sendMessage.mutateAsync(args);
      setResult(res);
      // Recents are phone-keyed — a group send has no phone to remember.
      if (messageType !== "group") addRecipient(form.formData.phone);
      showSuccess(t("success"));
    } catch {
      // Error surfaced by the mutation's onError toast.
    }
  }, [form, buildArgs, sendMessage, addRecipient, showSuccess, t, messageType]);

  const handleReset = useCallback(() => {
    reset({
      deviceId: form.formData.deviceId,
      messageType: "text",
      phone: "",
      ...EMPTY_TYPE_FIELDS,
    });
    setResult(null);
  }, [reset, form.formData.deviceId]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      {isLoading ? (
        <ListPageSkeleton />
      ) : connectedDevices.length === 0 ? (
        <EmptyState
          icon={FiSend}
          title={t("empty.title")}
          description={t("empty.description")}
          actionLabel={t("empty.action")}
          onAction={() => navigate(ROUTE_PATHS.devices)}
        />
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5} alignItems="start">
          {/* Compose (request) */}
          <SectionCard>
            <Flex direction="column" gap={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <SelectField
                  label={t("fields.device")}
                  options={deviceOptions}
                  value={form.formData.deviceId}
                  onChange={(v) => setField("deviceId", v)}
                  error={form.errors.deviceId ? t("errors.deviceRequired") : undefined}
                />
                <SelectField
                  label={t("fields.type")}
                  options={typeOptions}
                  value={messageType}
                  onChange={handleTypeChange}
                />
              </SimpleGrid>

              {messageType === "group" ? (
                <SelectField
                  label={t("fields.group")}
                  placeholder={groupPlaceholder}
                  options={groupOptions}
                  value={form.formData.groupJid}
                  onChange={(v) => setField("groupJid", v)}
                  error={
                    form.errors.groupJid ? t("errors.groupRequired") : undefined
                  }
                />
              ) : (
                <RecipientNumberField
                  label={t("fields.phone")}
                  placeholder={t("fields.phonePlaceholder")}
                  value={form.formData.phone}
                  onChange={(v) => setField("phone", maskPhoneBr(v))}
                  error={form.errors.phone ? t("errors.phoneInvalid") : undefined}
                  inputMode="tel"
                  recents={recents}
                  onSelectRecent={(digits) => setField("phone", maskPhoneBr(digits))}
                  onRemoveRecent={removeRecipient}
                />
              )}

              {(messageType === "text" || messageType === "group") && (
                <TextAreaField
                  label={t("fields.text")}
                  placeholder={t("fields.textPlaceholder")}
                  value={form.formData.text}
                  onChange={(v) => setField("text", v)}
                  error={form.errors.text ? t("errors.textRequired") : undefined}
                  rows={6}
                />
              )}

              {isMedia(messageType) && (
                <>
                  <FormField
                    label={t(`fields.media.${messageType}`)}
                    placeholder={t("fields.mediaPlaceholder")}
                    helperText={t("fields.mediaHelper")}
                    value={form.formData.mediaUrl}
                    onChange={(v) => setField("mediaUrl", v)}
                    error={form.errors.mediaUrl ? t("errors.mediaRequired") : undefined}
                  />
                  {messageType === "document" && (
                    <FormField
                      label={t("fields.fileName")}
                      placeholder={t("fields.fileNamePlaceholder")}
                      value={form.formData.fileName}
                      onChange={(v) => setField("fileName", v)}
                    />
                  )}
                  {messageType !== "audio" && (
                    <FormField
                      label={t("fields.caption")}
                      placeholder={t("fields.captionPlaceholder")}
                      value={form.formData.caption}
                      onChange={(v) => setField("caption", v)}
                    />
                  )}
                </>
              )}

              <Flex justify="flex-end" gap={2}>
                <Button variant="ghost" onClick={handleReset}>
                  {t("actions.clear")}
                </Button>
                <Button
                  colorScheme="brand"
                  leftIcon={<Icon as={FiSend} />}
                  onClick={handleSend}
                  isLoading={sendMessage.isPending}
                >
                  {t("actions.send")}
                </Button>
              </Flex>
            </Flex>
          </SectionCard>

          {/* Result (response) */}
          <SandboxResult
            messageId={result?.messageId ?? null}
            status={liveStatus}
            failureReason={failureReason}
            isPolling={isPolling}
            isError={statusError}
          />
        </SimpleGrid>
      )}
    </>
  );
}
