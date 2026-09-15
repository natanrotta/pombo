import { Box, Skeleton, VStack } from "@chakra-ui/react";

interface SectionCardSkeletonProps {
  lines?: number;
  height?: string;
}

export function SectionCardSkeleton({
  lines = 4,
  height,
}: SectionCardSkeletonProps) {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="shadow.card"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
      h={height}
    >
      <Skeleton h="16px" w="40%" mb={4} borderRadius="md" />
      <VStack gap={3} align="stretch">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            h="14px"
            w={i % 2 === 0 ? "90%" : "70%"}
            borderRadius="md"
          />
        ))}
      </VStack>
    </Box>
  );
}
