import { useCallback } from "react";
import { Button, Icon } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiDownload } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { useNotify } from "@/shared/hooks/useNotify";
import { downloadJson } from "@/shared/utils/download";
import { buildPostmanCollection } from "@/modules/account/presentation/utils/postmanCollection";
import { ApiTokenTab } from "@/modules/account/presentation/components/ApiTokenTab";

/** Absolute base of the public API (`…/api/v1`) for the Postman collection's
 *  `{{baseUrl}}` default. `VITE_API_URL` may be relative (`/api`) — resolve it
 *  against the current origin so the exported file targets this deployment. */
function resolvePublicApiBaseUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL || "/api";
  const absolute = apiBase.startsWith("http")
    ? apiBase
    : `${window.location.origin}${apiBase}`;
  return `${absolute.replace(/\/$/, "")}/v1`;
}

/** Standalone "API" screen (was a tab in the old Settings page). */
export function ApiPage() {
  const { t } = useTranslation("settings");
  const { showSuccess } = useNotify();

  const handleDownloadCollection = useCallback(() => {
    const collection = buildPostmanCollection(resolvePublicApiBaseUrl());
    downloadJson("pombo-api.postman_collection.json", collection);
    showSuccess(t("apiToken.collection.success"));
  }, [showSuccess, t]);

  return (
    <>
      <PageHeader
        title={t("apiPage.title")}
        description={t("apiPage.description")}
        actions={
          <Button variant="outline" size="md" onClick={handleDownloadCollection}>
            <Icon boxSize={3.5} color="text.brand">
              <FiDownload />
            </Icon>
            {t("apiToken.collection.button")}
          </Button>
        }
      />
      <ApiTokenTab />
    </>
  );
}
