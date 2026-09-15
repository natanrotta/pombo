import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Code,
  Flex,
  Icon,
  SimpleGrid,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiDownload,
  FiRefreshCw,
  FiShield,
} from "@/shared/components/icons";
import { AppModal } from "@/shared/components/ui/AppModal";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { InfoRow } from "@/shared/components/ui/InfoRow";
import { SectionCardSkeleton } from "@/shared/components/skeletons/SectionCardSkeleton";
import { FormField } from "@/shared/components/forms/FormField";
import { useNotify } from "@/shared/hooks/useNotify";
import { formatDateTime, formatShortDate } from "@/shared/utils/date";
import { downloadJson } from "@/shared/utils/download";
import { buildPostmanCollection } from "@/modules/account/presentation/utils/postmanCollection";
import {
  useApiToken,
  useGenerateApiToken,
} from "@/modules/account/presentation/hooks/useApiToken";

/** Absolute base of the public API (`…/api/v1`) for the Postman collection's
 *  `{{baseUrl}}` default. `VITE_API_URL` may be relative (`/api`) — resolve it
 *  against the current origin so the exported file targets this deployment. */
function resolvePublicApiBaseUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const absolute = apiBase.startsWith("http")
    ? apiBase
    : `${window.location.origin}${apiBase}`;
  return `${absolute.replace(/\/$/, "")}/v1`;
}

export function ApiTokenTab() {
  const { t } = useTranslation("settings");
  const { showSuccess } = useNotify();
  const { data: token, isLoading } = useApiToken();
  const generate = useGenerateApiToken();
  const regenerateConfirm = useDisclosure();

  // The clear token is shown exactly once, right after generation.
  const [clearToken, setClearToken] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    regenerateConfirm.onClose();
    try {
      const result = await generate.mutateAsync();
      setClearToken(result.token);
      showSuccess(t("apiToken.generated"));
    } catch {
      // Error surfaced by the mutation's onError toast.
    }
  }, [generate, regenerateConfirm, showSuccess, t]);

  const handleDownloadCollection = useCallback(() => {
    const collection = buildPostmanCollection(resolvePublicApiBaseUrl());
    downloadJson("pombo-api.postman_collection.json", collection);
    showSuccess(t("apiToken.collection.success"));
  }, [showSuccess, t]);

  return (
    <Flex direction="column" gap={5}>
      {isLoading ? (
        <SectionCardSkeleton lines={2} />
      ) : token ? (
        <SectionCard>
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align={{ base: "stretch", md: "center" }}
            gap={4}
          >
            <SimpleGrid columns={{ base: 1, sm: 3 }} gap={5} flex="1">
              <InfoRow
                label={t("apiToken.prefix")}
                value={token.prefix}
                action={
                  <CopyButton
                    value={token.prefix}
                    ariaLabel={t("apiToken.copyPrefix")}
                  />
                }
              />
              <InfoRow
                label={t("apiToken.createdAt")}
                value={formatShortDate(token.createdAt)}
              />
              <InfoRow
                label={t("apiToken.lastUsedAt")}
                value={
                  token.lastUsedAt
                    ? formatDateTime(token.lastUsedAt)
                    : t("apiToken.neverUsed")
                }
              />
            </SimpleGrid>
            <Button
              variant="outline"
              colorPalette="brand"
              onClick={regenerateConfirm.onOpen}
            >
              <Icon>
                <FiRefreshCw />
              </Icon>
              {t("apiToken.regenerate")}
            </Button>
          </Flex>
        </SectionCard>
      ) : (
        <EmptyState
          icon={FiShield}
          title={t("apiToken.empty.title")}
          description={t("apiToken.empty.description")}
          actionLabel={t("apiToken.generate")}
          onAction={handleGenerate}
        />
      )}

      <SectionCard variant="sunken">
        <Text fontSize="sm" fontWeight="600" color="text.primary" mb={1}>
          {t("apiToken.usage.title")}
        </Text>
        <Text fontSize="xs" color="text.secondary" mb={2}>
          {t("apiToken.usage.description")}
        </Text>
        <Flex align="center" gap={2}>
          <Code
            fontSize="xs"
            px={3}
            py={2}
            borderRadius="md"
            flex="1"
            whiteSpace="pre-wrap"
          >
            {t("apiToken.usage.codeExample")}
          </Code>
          <CopyButton
            value={t("apiToken.usage.codeExample")}
            ariaLabel={t("apiToken.usage.copy")}
          />
        </Flex>

        <Flex
          direction={{ base: "column", sm: "row" }}
          align={{ base: "stretch", sm: "center" }}
          justify="space-between"
          gap={3}
          mt={4}
          pt={4}
          borderTopWidth="1px"
          borderColor="border.subtle"
        >
          <Text fontSize="xs" color="text.secondary">
            {t("apiToken.collection.description")}
          </Text>
          <Button
            variant="outline"
            colorPalette="brand"
            size="sm"
            onClick={handleDownloadCollection}
            flexShrink={0}
          >
            <Icon>
              <FiDownload />
            </Icon>
            {t("apiToken.collection.button")}
          </Button>
        </Flex>
      </SectionCard>

      <AppModal
        isOpen={clearToken !== null}
        onClose={() => setClearToken(null)}
        title={t("apiToken.reveal.title")}
        primaryActionLabel={t("apiToken.reveal.done")}
        onPrimaryAction={() => setClearToken(null)}
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
                value={clearToken ?? ""}
                onChange={() => undefined}
                readOnly
                fontFamily="mono"
                fontSize="sm"
              />
              <CopyButton
                value={clearToken ?? ""}
                ariaLabel={t("apiToken.reveal.copy")}
              />
            </Flex>
          </Box>
        </Flex>
      </AppModal>

      <ConfirmDialog
        isOpen={regenerateConfirm.open}
        onClose={regenerateConfirm.onClose}
        onConfirm={handleGenerate}
        title={t("apiToken.regenerateConfirm.title")}
        description={t("apiToken.regenerateConfirm.description")}
        confirmLabel={t("apiToken.regenerate")}
        isDanger
        isLoading={generate.isPending}
      />
    </Flex>
  );
}
