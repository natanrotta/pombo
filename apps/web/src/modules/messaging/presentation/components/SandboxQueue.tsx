import { Flex, Icon, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiActivity } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import {
  SandboxQueueItem,
  type SandboxQueueEntry,
} from "./SandboxQueueItem";

interface SandboxQueueProps {
  items: SandboxQueueEntry[];
}

/** The Sandbox's "response" panel: the live send queue of the last burst. Each
 *  row polls its own delivery status, so the list drains top-to-bottom (FIFO)
 *  and the humanized pacing (typing + jitter + long pauses) is observable in
 *  real time. Empty placeholder before the first send. */
export function SandboxQueue({ items }: SandboxQueueProps) {
  const { t } = useTranslation("sandbox");
  const total = items.length;

  if (total === 0) {
    return (
      <SectionCard>
        <Flex
          direction="column"
          align="center"
          justify="center"
          gap={2}
          textAlign="center"
          minH="240px"
          py={8}
        >
          <Icon as={FiActivity} boxSize={8} color="text.muted" />
          <Text fontSize="sm" fontWeight="600" color="text.primary">
            {t("queue.empty.title")}
          </Text>
          <Text fontSize="xs" color="text.muted" maxW="xs">
            {t("queue.empty.description")}
          </Text>
        </Flex>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <Flex direction="column" gap={3}>
        <Flex align="center" justify="space-between" gap={3}>
          <Text fontSize="sm" fontWeight="600" color="text.primary">
            {t("queue.title")}
          </Text>
          <Text fontSize="xs" color="text.muted" flexShrink={0}>
            {t("queue.summary", { total })}
          </Text>
        </Flex>

        <Flex direction="column">
          {items.map((item, i) => (
            <SandboxQueueItem
              key={item.messageId}
              messageId={item.messageId}
              index={i + 1}
              total={total}
              initialStatus={item.status}
            />
          ))}
        </Flex>

        <Text fontSize="xs" color="text.muted">
          {t("queue.pacingHint")}
        </Text>
      </Flex>
    </SectionCard>
  );
}
