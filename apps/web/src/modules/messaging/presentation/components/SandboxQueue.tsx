import { Box, Button, Flex, Icon, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiActivity } from "@/shared/components/icons";
import { SandboxQueueItem, type SandboxQueueEntry } from "./SandboxQueueItem";

interface SandboxQueueProps {
  items: SandboxQueueEntry[];
  /** Empties the panel without touching the composed message. */
  onClear: () => void;
}

/** The Sandbox's "response" panel: the live send queue of the last burst. Each
 *  row polls its own delivery status, so the list drains top-to-bottom (FIFO)
 *  and the humanized pacing (typing + jitter + long pauses) is observable in
 *  real time. Empty placeholder before the first send. */
export function SandboxQueue({ items, onClear }: SandboxQueueProps) {
  const { t } = useTranslation("sandbox");
  const total = items.length;

  return (
    <Flex
      direction="column"
      minH="400px"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      overflow="hidden"
      data-cy="sandbox-queue"
    >
      <Flex
        align="center"
        justify="space-between"
        gap={3}
        px={4.5}
        py={4}
        borderBottomWidth="1px"
        borderColor="border.default"
      >
        <Flex direction="column" gap={0.5} minW={0}>
          <Text textStyle="sectionTitle" color="text.primary">
            {t("queue.title")}
          </Text>
          <Text textStyle="caption" color="text.secondary">
            {t("queue.subtitle")}
          </Text>
        </Flex>
        {total > 0 && (
          <Button variant="ghost" size="xs" color="text.brand" onClick={onClear}>
            {t("actions.clear")}
          </Button>
        )}
      </Flex>

      {total === 0 ? (
        <Flex
          flex="1"
          direction="column"
          align="center"
          justify="center"
          gap={2.5}
          textAlign="center"
          px={7}
          py={10}
        >
          <Icon boxSize={10} color="border.strong">
            <FiActivity />
          </Icon>
          <Text textStyle="sectionTitle" color="text.secondary">
            {t("queue.empty.title")}
          </Text>
          <Text textStyle="caption" color="text.muted" maxW="32ch">
            {t("queue.empty.description")}
          </Text>
        </Flex>
      ) : (
        <Box flex="1">
          {items.map((item, i) => (
            <SandboxQueueItem
              key={item.messageId}
              messageId={item.messageId}
              index={i + 1}
              total={total}
              initialStatus={item.status}
            />
          ))}
        </Box>
      )}
    </Flex>
  );
}
