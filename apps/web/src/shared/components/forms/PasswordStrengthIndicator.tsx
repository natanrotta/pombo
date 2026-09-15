import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiX } from "@/shared/components/icons";

interface PasswordRule {
  key: string;
  test: (password: string) => boolean;
}

const RULES: PasswordRule[] = [
  { key: "password.rules.length", test: (p) => p.length >= 8 },
  { key: "password.rules.uppercase", test: (p) => /[A-Z]/.test(p) },
  { key: "password.rules.lowercase", test: (p) => /[a-z]/.test(p) },
  { key: "password.rules.number", test: (p) => /\d/.test(p) },
  { key: "password.rules.special", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password: string): number {
  if (!password) return 0;
  return RULES.filter((rule) => rule.test(password)).length;
}

const STRENGTH_COLORS: Record<number, string> = {
  0: "gray.200",
  1: "red.400",
  2: "purple.300",
  3: "purple.400",
  4: "blue.400",
  5: "green.400",
};

const STRENGTH_KEYS: Record<number, string> = {
  0: "",
  1: "password.strength.veryWeak",
  2: "password.strength.weak",
  3: "password.strength.fair",
  4: "password.strength.good",
  5: "password.strength.strong",
};

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation("auth");
  const strength = useMemo(() => getStrength(password), [password]);
  const color = STRENGTH_COLORS[strength];
  const strengthKey = STRENGTH_KEYS[strength];

  if (!password) return null;

  return (
    <VStack align="stretch" gap={2} mt={1}>
      <HStack gap={1}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box
            key={i}
            h="3px"
            flex={1}
            borderRadius="full"
            bg={i < strength ? color : "gray.200"}
            transition="background 0.2s"
          />
        ))}
      </HStack>

      <HStack justify="space-between">
        <Text fontSize="xs" color={color} fontWeight="600">
          {strengthKey ? t(strengthKey) : ""}
        </Text>
      </HStack>

      <VStack align="stretch" gap={0.5}>
        {RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <HStack key={rule.key} gap={1.5}>
              <Box
                as={passed ? FiCheck : FiX}
                color={passed ? "green.500" : "gray.400"}
                boxSize={3}
              />
              <Text
                fontSize="xs"
                color={passed ? "text.primary" : "text.secondary"}
              >
                {t(rule.key)}
              </Text>
            </HStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
