import { Box, Button, Flex, Icon, SimpleGrid, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiSend } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { SelectField } from "@/shared/components/forms/SelectField";
import { NumberField } from "@/shared/components/forms/NumberField";
import { maskPhoneBr } from "@/shared/utils/phone";
import { RecipientNumberField } from "@/modules/messaging/presentation/components/RecipientNumberField";
import { GroupRecipientField } from "@/modules/messaging/presentation/components/GroupRecipientField";
import { SandboxMessageFields } from "@/modules/messaging/presentation/components/SandboxMessageFields";
import type { SandboxComposerState } from "@/modules/messaging/presentation/hooks/useSandboxComposer";
import {
  MAX_BURST,
  PHONE_NOT_ON_WHATSAPP,
  clampCount,
} from "@/modules/messaging/presentation/utils/sandboxForm";

interface SandboxComposerProps {
  composer: SandboxComposerState;
}

/** The Sandbox's "request" panel: device, type, recipient, content and burst
 *  size, plus the send/clear actions. */
export function SandboxComposer({ composer }: SandboxComposerProps) {
  const { t } = useTranslation("sandbox");
  const { formData, errors, setField } = composer;

  const phoneError =
    errors.phone === PHONE_NOT_ON_WHATSAPP
      ? t("errors.phoneNotOnWhatsApp")
      : errors.phone
        ? t("errors.phoneInvalid")
        : undefined;

  return (
    <SectionCard>
      <Flex direction="column" gap={4}>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <SelectField
            label={t("fields.device")}
            options={composer.deviceOptions}
            value={formData.deviceId}
            onChange={(value) => setField("deviceId", value)}
            error={errors.deviceId ? t("errors.deviceRequired") : undefined}
          />
          <SelectField
            label={t("fields.type")}
            options={composer.typeOptions}
            value={formData.messageType}
            onChange={composer.handleTypeChange}
          />
        </SimpleGrid>

        {formData.messageType === "group" ? (
          <GroupRecipientField
            deviceId={formData.deviceId}
            value={formData.groupJid}
            onChange={(value) => setField("groupJid", value)}
            error={errors.groupJid ? t("errors.groupRequired") : undefined}
          />
        ) : (
          <RecipientNumberField
            label={t("fields.phone")}
            placeholder={t("fields.phonePlaceholder")}
            value={formData.phone}
            onChange={(value) => setField("phone", maskPhoneBr(value))}
            error={phoneError}
            inputMode="tel"
            recents={composer.recents}
            onSelectRecent={(digits) => setField("phone", maskPhoneBr(digits))}
            onRemoveRecent={composer.removeRecipient}
          />
        )}

        <SandboxMessageFields
          formData={formData}
          errors={errors}
          onChange={setField}
        />

        <Flex direction="column" gap={1}>
          <Box maxW="160px">
            <NumberField
              label={t("fields.count")}
              value={formData.count}
              onChange={(value) => setField("count", clampCount(value))}
              min={1}
              max={MAX_BURST}
              error={errors.count ? t("errors.countInvalid") : undefined}
            />
          </Box>
          <Text fontSize="xs" color="text.secondary">
            {t("fields.countHelper")}
          </Text>
        </Flex>

        <Flex
          justify="flex-end"
          gap={2.5}
          pt={4}
          borderTopWidth="1px"
          borderColor="border.subtle"
        >
          <Button variant="outline" size="md" onClick={composer.handleReset}>
            {t("actions.clear")}
          </Button>
          <Button
            variant="subtle"
            size="md"
            onClick={composer.handleSend}
            loading={composer.isSending}
          >
            <Icon boxSize={3.5}>
              <FiSend />
            </Icon>
            {t("actions.send")}
          </Button>
        </Flex>
      </Flex>
    </SectionCard>
  );
}
