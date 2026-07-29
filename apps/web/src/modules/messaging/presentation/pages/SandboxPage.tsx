import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Flex, Icon, SimpleGrid, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiSend } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ListPageSkeleton } from "@/shared/components/skeletons/ListPageSkeleton";
import { SelectField } from "@/shared/components/forms/SelectField";
import { FormField } from "@/shared/components/forms/FormField";
import { NumberField } from "@/shared/components/forms/NumberField";
import { TextAreaField } from "@/shared/components/forms/TextAreaField";
import { useFormState } from "@/shared/hooks/useFormState";
import { useNotify } from "@/shared/hooks/useNotify";
import { maskPhoneBr, unformatPhone, formatPhoneDisplay } from "@/shared/utils/phone";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useDevicesList, useDeviceGroups } from "@/modules/devices";
import {
  useSendMessage,
  type SendMessageArgs,
} from "@/modules/messaging/presentation/hooks/useSendMessage";
import { useRecentRecipients } from "@/modules/messaging/presentation/hooks/useRecentRecipients";
import { RecipientNumberField } from "@/modules/messaging/presentation/components/RecipientNumberField";
import { SandboxQueue } from "@/modules/messaging/presentation/components/SandboxQueue";
import {
  type MessageType,
  type SandboxMessageType,
  type SendMessageResult,
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

// Burst ceiling — enough to watch the queue drain with pacing, without letting a
// stray value fire hundreds of real WhatsApp sends.
const MAX_BURST = 20;
const clampCount = (value: number): number =>
  Math.max(1, Math.min(MAX_BURST, Math.round(value) || 1));

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
  /** How many messages to enqueue in one send — the burst that exercises the
   *  drain's humanized pacing (typing + jitter + long pauses). */
  count: number;
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

  // The live send queue of the last burst (each row polls its own status).
  const [sends, setSends] = useState<SendMessageResult[]>([]);
  const [isSending, setIsSending] = useState(false);

  const form = useFormState<SandboxForm>(
    {
      deviceId: "",
      messageType: "text",
      phone: "",
      count: 1,
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
      count: (v) => (v >= 1 && v <= MAX_BURST ? null : "invalid"),
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
        count: form.formData.count,
        ...EMPTY_TYPE_FIELDS,
      });
    },
    [reset, form.formData.deviceId, form.formData.phone, form.formData.count],
  );

  // Build the send args for message `index` of a burst of `total`. For text and
  // group sends a `(i/N)` suffix is appended when it's a real burst, so the
  // messages are distinguishable AND their typing windows vary by length. Media
  // payloads ride unchanged (nothing sensible to suffix).
  const buildArgs = useCallback(
    (index: number, total: number): SendMessageArgs => {
      const deviceId = form.formData.deviceId;
      const phone = unformatPhone(form.formData.phone);
      const f = form.formData;
      const caption = f.caption.trim() || undefined;
      const suffix = total > 1 ? ` (${index}/${total})` : "";
      switch (f.messageType as SandboxMessageType) {
        case "text":
          return {
            deviceId,
            type: "text",
            input: { phone, text: f.text.trim() + suffix },
          };
        case "group":
          return {
            deviceId,
            type: "group",
            input: { groupJid: f.groupJid, text: f.text.trim() + suffix },
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
    },
    [form.formData],
  );

  // Enqueue the burst SEQUENTIALLY, revealing each row as it lands so the queue
  // grows live. Abort on the first failure: every message targets the same
  // device/recipient, so a failure (offline, not on WhatsApp) repeats — one
  // toast (the mutation's onError) beats N. The drain does the real pacing.
  const handleSend = useCallback(async () => {
    if (!form.validate()) return;
    const total = form.formData.count;
    setSends([]);
    setIsSending(true);
    const collected: SendMessageResult[] = [];
    try {
      for (let i = 1; i <= total; i++) {
        const res = await sendMessage.mutateAsync(buildArgs(i, total));
        collected.push(res);
        setSends([...collected]);
      }
    } catch {
      // Error surfaced by the mutation's onError toast; keep the rows enqueued
      // so far so their status is still observable.
    } finally {
      setIsSending(false);
    }
    if (collected.length > 0) {
      // Recents are phone-keyed — a group send has no phone to remember.
      if (messageType !== "group") addRecipient(form.formData.phone);
      showSuccess(t("success", { total: collected.length }));
    }
  }, [form, buildArgs, sendMessage, addRecipient, showSuccess, t, messageType]);

  const handleReset = useCallback(() => {
    reset({
      deviceId: form.formData.deviceId,
      messageType: "text",
      phone: "",
      count: 1,
      ...EMPTY_TYPE_FIELDS,
    });
    setSends([]);
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

              <Flex direction="column" gap={1}>
                <Box maxW="160px">
                  <NumberField
                    label={t("fields.count")}
                    value={form.formData.count}
                    onChange={(v) => setField("count", clampCount(v))}
                    min={1}
                    max={MAX_BURST}
                    error={
                      form.errors.count ? t("errors.countInvalid") : undefined
                    }
                  />
                </Box>
                <Text fontSize="xs" color="text.secondary">
                  {t("fields.countHelper")}
                </Text>
              </Flex>

              <Flex justify="flex-end" gap={2}>
                <Button variant="ghost" onClick={handleReset}>
                  {t("actions.clear")}
                </Button>
                <Button
                  colorScheme="brand"
                  leftIcon={<Icon as={FiSend} />}
                  onClick={handleSend}
                  isLoading={isSending}
                >
                  {t("actions.send")}
                </Button>
              </Flex>
            </Flex>
          </SectionCard>

          {/* Response — the live send queue of the last burst */}
          <SandboxQueue items={sends} />
        </SimpleGrid>
      )}
    </>
  );
}
