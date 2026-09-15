import { Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";

export function NotFoundPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  return (
    <Center minH="60vh">
      <Stack gap={4} align="center" textAlign="center" maxW="md" px={6}>
        <Heading size="2xl" color="text.brand">
          404
        </Heading>
        <Heading size="md" color="text.primary">
          {t("notFound.title", "Página não encontrada")}
        </Heading>
        <Text color="text.secondary">
          {t(
            "notFound.description",
            "A página que você procura não existe ou foi movida.",
          )}
        </Text>
        <Button
          data-cy="not-found-home"
          onClick={() => navigate(ROUTE_PATHS.devices)}
        >
          {t("notFound.backHome", "Voltar ao início")}
        </Button>
      </Stack>
    </Center>
  );
}
