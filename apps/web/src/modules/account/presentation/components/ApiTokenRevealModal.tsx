import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle } from "@/shared/components/icons";
import { AppModal } from "@/shared/components/ui/AppModal";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { FormField } from "@/shared/components/forms/FormField";

interface ApiTokenRevealModalProps {
  /** The clear token, or `null` when there is nothing to reveal. */
  token: string | null;
  onClose: () => void;
}

/** Shows a freshly generated token — the only time it is ever visible. */
export function ApiTokenRevealModal({ token, onClose }: ApiTokenRevealModalProps) {
  const { t } = useTranslation("settings");

  return (
    <AppModal
      isOpen={token !== null}
      onClose={onClose}
      title={t("apiToken.reveal.title")}
      primaryActionLabel={t("apiToken.reveal.done")}
      onPrimaryAction={onClose}
    >
      <Flex direction="column" gap={4}>
        <Flex
          align="flex-start"
          gap={3}
          bg="status.warning.bg"
          borderRadius="md"
          p={3}
        >
          <Icon color="status.warning.fg" mt={0.5}>
            <FiAlertTriangle />
          </Icon>
          <Text fontSize="sm" color="text.primary">
            {t("apiToken.reveal.warning")}
          </Text>
        </Flex>
        <Box>
          <Text fontSize="xs" color="text.secondary" mb={1}>
            {t("apiToken.reveal.label")}
          </Text>
          <Flex align="center" gap={2}>
            <FormField
              aria-label={t("apiToken.reveal.label")}
              value={token ?? ""}
              onChange={() => undefined}
              readOnly
              fontFamily="mono"
              fontSize="sm"
            />
            <CopyButton
              value={token ?? ""}
              ariaLabel={t("apiToken.reveal.copy")}
            />
          </Flex>
        </Box>
      </Flex>
    </AppModal>
  );
}
