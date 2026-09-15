import {
  Box,
  Flex,
  Grid,
  Skeleton,
  SkeletonCircle,
  VStack,
} from "@chakra-ui/react";
import { SectionCardSkeleton } from "./SectionCardSkeleton";

interface DetailPageSkeletonProps {
  variant?: "two-column" | "profile" | "single";
}

export function DetailPageSkeleton({
  variant = "two-column",
}: DetailPageSkeletonProps) {
  if (variant === "profile") {
    return (
      <VStack gap={5} align="stretch">
        <Flex align="center" gap={4}>
          <SkeletonCircle size="16" />
          <Box flex={1}>
            <Skeleton h="20px" w="200px" mb={2} borderRadius="md" />
            <Skeleton h="14px" w="140px" borderRadius="md" />
          </Box>
        </Flex>
        <SectionCardSkeleton lines={5} />
        <SectionCardSkeleton lines={3} />
      </VStack>
    );
  }

  if (variant === "single") {
    return (
      <VStack gap={5} align="stretch">
        <SectionCardSkeleton lines={4} />
        <SectionCardSkeleton lines={6} />
      </VStack>
    );
  }

  return (
    <Grid templateColumns={{ base: "1fr", lg: "3fr 2fr" }} gap={5}>
      <VStack gap={5} align="stretch">
        <SectionCardSkeleton lines={5} />
        <SectionCardSkeleton lines={4} />
      </VStack>
      <VStack gap={5} align="stretch">
        <SectionCardSkeleton lines={3} />
        <SectionCardSkeleton lines={3} />
      </VStack>
    </Grid>
  );
}
