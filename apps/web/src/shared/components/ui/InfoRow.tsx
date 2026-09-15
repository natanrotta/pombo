import { memo, type ReactNode } from "react";
import { Flex, Stack, Text } from "@chakra-ui/react";

interface InfoRowProps {
  label: string;
  value: string;
  /** Optional trailing control (e.g. a copy button) rendered inline, centered
   *  on the value line. */
  action?: ReactNode;
}

/** A labelled read-only value: a muted label above a primary value, with an
 *  optional trailing action aligned to the value line. */
export const InfoRow = memo(function InfoRow({
  label,
  value,
  action,
}: InfoRowProps) {
  return (
    <Stack gap={0.5}>
      <Text fontSize="xs" color="text.secondary">
        {label}
      </Text>
      {action ? (
        <Flex align="center" gap={1}>
          <Text fontSize="sm" fontWeight="600" color="text.primary">
            {value}
          </Text>
          {action}
        </Flex>
      ) : (
        <Text fontSize="sm" fontWeight="600" color="text.primary">
          {value}
        </Text>
      )}
    </Stack>
  );
});
