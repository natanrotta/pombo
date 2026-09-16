import { Button, Flex, Icon, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { formatDateTime, formatShortDate } from "@/shared/utils/date";
import type { ApiTokenMetadata } from "@/modules/account/domain/entities/ApiToken";

interface ApiTokenSummaryCardProps {
  token: ApiTokenMetadata;
  onRegenerate: () => void;
}

/**
 * The active token: what is safe to show (its prefix), when it was created,
 * when it was last used, and the "generate a new one" action.
 *
 * The clear token is NOT here — it is shown exactly once, right after it is
 * generated (`ApiTokenRevealModal`). That is why this card has no reveal.
 */
export function ApiTokenSummaryCard({
  token,
  onRegenerate,
}: ApiTokenSummaryCardProps) {
  const { t } = useTranslation("settings");

  const meta = [
    t("apiToken.createdAtValue", { date: formatShortDate(token.createdAt) }),
    token.lastUsedAt
      ? t("apiToken.lastUsedAtValue", { date: formatDateTime(token.lastUsedAt) })
      : t("apiToken.neverUsed"),
  ].join(" · ");

  return (
    <SectionCard>
      <Flex direction="column" gap={4}>
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "stretch", md: "flex-start" }}
          gap={3}
        >
          <Flex direction="column" gap={0.5} minW={0}>
            <Text textStyle="sectionTitle" color="text.primary">
              {t("apiToken.title")}
            </Text>
            <Text textStyle="caption" color="text.secondary">
              {meta}
            </Text>
          </Flex>
          <Button
            variant="subtle"
            size="md"
            onClick={onRegenerate}
            alignSelf={{ base: "flex-start", md: "auto" }}
          >
            <Icon boxSize={3.5}>
              <FiRefreshCw />
            </Icon>
            {t("apiToken.regenerate")}
          </Button>
        </Flex>

        {/* The prefix is the token's public handle: enough to tell two tokens
            apart in a log, useless as a credential. */}
        <Flex
          align="center"
          gap={2.5}
          bg="bg.canvas"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="md"
          px={3.5}
          py={3}
        >
          <Text
            as="code"
            flex="1"
            minW={0}
            textStyle="mono"
            fontSize="13.5px"
            color="text.brand"
            lineClamp={1}
          >
            {token.prefix}
            <Text as="span" color="text.disabled">
              {"•".repeat(24)}
            </Text>
          </Text>
          <CopyButton
            value={token.prefix}
            ariaLabel={t("apiToken.copyPrefix")}
          />
        </Flex>

        <Text textStyle="caption" color="text.muted">
          {t("apiToken.rotationNote")}
        </Text>
      </Flex>
    </SectionCard>
  );
}
