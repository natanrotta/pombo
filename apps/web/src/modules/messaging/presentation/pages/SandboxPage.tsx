import { useMemo } from "react";
import { SimpleGrid } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiSend } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ListPageSkeleton } from "@/shared/components/skeletons/ListPageSkeleton";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useDevicesList } from "@/modules/devices";
import { useSandboxComposer } from "@/modules/messaging/presentation/hooks/useSandboxComposer";
import { SandboxComposer } from "@/modules/messaging/presentation/components/SandboxComposer";
import { SandboxQueue } from "@/modules/messaging/presentation/components/SandboxQueue";

export function SandboxPage() {
  const { t } = useTranslation("sandbox");
  const navigate = useNavigate();

  const { data: devices = [], isLoading } = useDevicesList();
  const connectedDevices = useMemo(
    () => devices.filter((device) => device.status === "CONNECTED"),
    [devices],
  );
  const composer = useSandboxComposer(connectedDevices);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      {isLoading ? (
        <ListPageSkeleton />
      ) : connectedDevices.length === 0 ? (
        <EmptyState
          icon={FiSend}
          title={t("empty.title")}
          description={t("empty.description")}
          actionLabel={t("empty.action")}
          onAction={() => navigate(ROUTE_PATHS.devices)}
        />
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={5} alignItems="start">
          <SandboxComposer composer={composer} />
          {/* Response — the live send queue of the last burst */}
          <SandboxQueue items={composer.sends} />
        </SimpleGrid>
      )}
    </>
  );
}
