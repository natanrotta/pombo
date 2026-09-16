import { Flex, Separator, Text } from "@chakra-ui/react";

interface AuthDividerProps {
  label: string;
}

/** "or" rule between the Google button and the e-mail form. */
export function AuthDivider({ label }: AuthDividerProps) {
  return (
    <Flex align="center" my={4}>
      <Separator flex="1" />
      <Text px={3} color="text.secondary" fontSize="sm" whiteSpace="nowrap">
        {label}
      </Text>
      <Separator flex="1" />
    </Flex>
  );
}
