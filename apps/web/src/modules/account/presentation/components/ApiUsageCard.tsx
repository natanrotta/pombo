import { Code, Flex, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { CopyButton } from "@/shared/components/ui/CopyButton";

/** How to call the public API with the token, plus the Postman collection. */
export function ApiUsageCard() {
  const { t } = useTranslation("settings");

  return (
    <SectionCard variant="sunken">
      <Text textStyle="sectionTitle" color="text.primary" mb={1}>
        {t("apiToken.usage.title")}
      </Text>
      <Text textStyle="caption" color="text.secondary" mb={3}>
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

      <Text textStyle="caption" color="text.muted" mt={3}>
        {t("apiToken.collection.description")}
      </Text>
    </SectionCard>
  );
}
