import { useCallback, useState } from "react";
import { Flex, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiShield } from "@/shared/components/icons";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { SectionCardSkeleton } from "@/shared/components/skeletons/SectionCardSkeleton";
import { useNotify } from "@/shared/hooks/useNotify";
import { ApiTokenSummaryCard } from "@/modules/account/presentation/components/ApiTokenSummaryCard";
import { ApiUsageCard } from "@/modules/account/presentation/components/ApiUsageCard";
import { ApiTokenRevealModal } from "@/modules/account/presentation/components/ApiTokenRevealModal";
import {
  useApiToken,
  useGenerateApiToken,
} from "@/modules/account/presentation/hooks/useApiToken";

export function ApiTokenTab() {
  const { t } = useTranslation("settings");
  const { showSuccess } = useNotify();
  const { data: token, isLoading } = useApiToken();
  const { mutateAsync: generateToken, isPending: isGenerating } =
    useGenerateApiToken();
  const regenerateConfirm = useDisclosure();
  const { onClose: closeRegenerateConfirm } = regenerateConfirm;

  // The clear token is shown exactly once, right after generation.
  const [clearToken, setClearToken] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    closeRegenerateConfirm();
    try {
      const result = await generateToken();
      setClearToken(result.token);
      showSuccess(t("apiToken.generated"));
    } catch {
      // Error surfaced by the mutation's onError toast.
    }
  }, [closeRegenerateConfirm, generateToken, showSuccess, t]);

  const handleCloseReveal = useCallback(() => setClearToken(null), []);

  return (
    <Flex direction="column" gap={5}>
      {isLoading ? (
        <SectionCardSkeleton lines={2} />
      ) : token ? (
        <ApiTokenSummaryCard
          token={token}
          onRegenerate={regenerateConfirm.onOpen}
        />
      ) : (
        <EmptyState
          icon={FiShield}
          title={t("apiToken.empty.title")}
          description={t("apiToken.empty.description")}
          actionLabel={t("apiToken.generate")}
          onAction={handleGenerate}
        />
      )}

      <ApiUsageCard />

      <ApiTokenRevealModal token={clearToken} onClose={handleCloseReveal} />

      <ConfirmDialog
        isOpen={regenerateConfirm.open}
        onClose={closeRegenerateConfirm}
        onConfirm={handleGenerate}
        title={t("apiToken.regenerateConfirm.title")}
        description={t("apiToken.regenerateConfirm.description")}
        confirmLabel={t("apiToken.regenerate")}
        isDanger
        isLoading={isGenerating}
      />
    </Flex>
  );
}
