import { Button, Flex, Icon, SimpleGrid } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { InfoRow } from "@/shared/components/ui/InfoRow";
import { formatDateTime, formatShortDate } from "@/shared/utils/date";
import type { ApiTokenMetadata } from "@/modules/account/domain/entities/ApiToken";

interface ApiTokenSummaryCardProps {
  token: ApiTokenMetadata;
  onRegenerate: () => void;
}

/** The active token's display-safe metadata and the "generate new" action. */
export function ApiTokenSummaryCard({
  token,
  onRegenerate,
}: ApiTokenSummaryCardProps) {
  const { t } = useTranslation("settings");

  return (
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
        <Button variant="outline" onClick={onRegenerate}>
          <Icon>
            <FiRefreshCw />
          </Icon>
          {t("apiToken.regenerate")}
        </Button>
      </Flex>
    </SectionCard>
  );
}
