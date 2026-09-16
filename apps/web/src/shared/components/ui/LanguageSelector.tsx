import { Flex, Text } from "@chakra-ui/react";
import { useNotify } from "@/shared/hooks/useNotify";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/modules/auth";
import { useErrorHandler } from "@/core/query/useErrorHandler";

const LANGUAGES = [
  { value: "pt-BR", flag: "🇧🇷", code: "pt-br" },
  { value: "en", flag: "🇺🇸", code: "en" },
  { value: "es", flag: "🇪🇸", code: "es" },
] as const;

// Render each language's name in its OWN language (e.g. "Português", "English",
// "Español") so the picker reads natively regardless of the active UI locale.
function getNativeName(locale: string): string {
  try {
    const display = new Intl.DisplayNames([locale], { type: "language" });
    const name = display.of(locale);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : locale;
  } catch {
    return locale;
  }
}

export function LanguageSelector() {
  const { i18n, t } = useTranslation("common");
  const { user, updateProfile } = useAuth();
  const { handleError } = useErrorHandler();
  const { showInfo } = useNotify();
  const currentLanguage = i18n.language;

  async function handleChange(language: string) {
    if (language === currentLanguage) return;
    const selected = LANGUAGES.find((l) => l.value === language);
    const selectedLabel = selected ? getNativeName(selected.value) : language;
    await i18n.changeLanguage(language);

    // One toast entry point app-wide: the flag rides the title so the cue
    // survives without a bespoke renderer (v3 moved rendering to <Toaster/>).
    showInfo(
      `${selected?.flag ?? ""} ${t("language.changed", { language: selectedLabel })}`.trim(),
    );

    if (user) {
      try {
        await updateProfile({ language });
      } catch (error) {
        handleError(error);
      }
    }
  }

  return (
    <Flex
      align="center"
      gap="2px"
      p="3px"
      bg="bg.canvas"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="md"
      flexShrink={0}
    >
      {LANGUAGES.map((lang) => {
        const isActive = currentLanguage === lang.value;
        const label = getNativeName(lang.value);
        return (
          <Flex
            key={lang.value}
            as="button"
            aria-label={label}
            aria-pressed={isActive}
            data-cy={`language-option-${lang.value}`}
            align="center"
            justify="center"
            gap={1.5}
            h="30px"
            px={3}
            borderRadius="sm"
            cursor="pointer"
            fontFamily="mono"
            fontSize="12.5px"
            color={isActive ? "text.brand" : "text.secondary"}
            bg={isActive ? "bg.brand.subtle" : "transparent"}
            boxShadow={
              isActive
                ? "inset 0 0 0 1px var(--chakra-colors-border-accent)"
                : undefined
            }
            transition="background-color 150ms ease, color 150ms ease"
            _hover={
              isActive ? { bg: "bg.brand.subtle" } : { color: "text.primary" }
            }
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "border.focus",
              outlineOffset: "1px",
            }}
            onClick={() => handleChange(lang.value)}
          >
            <Text
              as="span"
              fontSize="13px"
              lineHeight="1"
              opacity={isActive ? 1 : 0.75}
            >
              {lang.flag}
            </Text>
            {lang.code}
          </Flex>
        );
      })}
    </Flex>
  );
}
