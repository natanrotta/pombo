import { useCallback } from "react";
import { Button, Code, Flex, Icon, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiDownload } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { useNotify } from "@/shared/hooks/useNotify";
import { downloadJson } from "@/shared/utils/download";
import { buildPostmanCollection } from "@/modules/account/presentation/utils/postmanCollection";

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

/** How to call the public API with the token, plus the Postman collection. */
export function ApiUsageCard() {
  const { t } = useTranslation("settings");
  const { showSuccess } = useNotify();

  const handleDownloadCollection = useCallback(() => {
    const collection = buildPostmanCollection(resolvePublicApiBaseUrl());
    downloadJson("pombo-api.postman_collection.json", collection);
    showSuccess(t("apiToken.collection.success"));
  }, [showSuccess, t]);

  return (
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
  );
}
