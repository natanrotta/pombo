import { Box, Flex, Skeleton } from "@chakra-ui/react";
import { DetailPageSkeleton } from "./DetailPageSkeleton";

// Most route chunks and session checks resolve well under this, so the
// placeholder stays invisible for them instead of flashing for a few frames.
const REVEAL_DELAY = "300ms";

/**
 * Generic page placeholder (header + two section cards) for the content area
 * while a route chunk or the session check is pending. It fades in only after
 * `REVEAL_DELAY` — a CSS delay, so there is no timer or state to manage.
 */
export function RouteContentSkeleton() {
  return (
    <Box
      aria-busy="true"
      animationName="fade-in"
      animationDuration="moderate"
      animationDelay={REVEAL_DELAY}
      animationFillMode="backwards"
    >
      <Flex align="center" justify="space-between" gap={4} mb={6}>
        <Box flex={1}>
          <Skeleton h="24px" w="180px" mb={2} borderRadius="md" />
          <Skeleton h="14px" w="260px" maxW="full" borderRadius="md" />
        </Box>
        <Skeleton h="32px" w="120px" borderRadius="md" />
      </Flex>
      <DetailPageSkeleton variant="single" />
    </Box>
  );
}
