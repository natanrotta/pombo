import { useCallback } from "react";
import {
  Box,
  Button,
  Flex,
  Icon,
  SimpleGrid,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiLogOut,
  FiTrash2,
  FiZap,
} from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { DetailPageGuard } from "@/shared/components/ui/DetailPageGuard";
import { InfoRow } from "@/shared/components/ui/InfoRow";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { useNotify } from "@/shared/hooks/useNotify";
import { formatDateTime } from "@/shared/utils/date";
import { formatPhoneDisplay } from "@/shared/utils/phone";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { DeviceStatusBadge } from "@/modules/devices/presentation/components/DeviceStatusBadge";
import { DeviceWebhooksSection } from "@/modules/devices/presentation/components/DeviceWebhooksSection";
import { QrConnectModal } from "@/modules/devices/presentation/components/QrConnectModal";
import {
  useDeviceDetail,
  useDeleteDevice,
  useDisconnectDevice,
} from "@/modules/devices/presentation/hooks/useDevices";
import type { Device } from "@/modules/devices/domain/entities/Device";

function DeviceDetailContent({ device }: { device: Device }) {
  const { t } = useTranslation("devices");
  const navigate = useNavigate();
  const { showSuccess } = useNotify();
  const deleteDevice = useDeleteDevice();
  const disconnectDevice = useDisconnectDevice();
  const qrModal = useDisclosure();
  const deleteConfirm = useConfirm();
  const disconnectConfirm = useConfirm();

  const handleConfirmDelete = useCallback(() => {
    deleteConfirm.confirm(async (id) => {
      try {
        await deleteDevice.mutateAsync(id);
        showSuccess(t("detail.deleted"));
        // Replace: "back" must not land on the deleted device.
        navigate(ROUTE_PATHS.devices, { replace: true });
      } catch {
        // Error surfaced by the mutation's onError toast.
      }
    });
  }, [deleteConfirm, deleteDevice, showSuccess, t, navigate]);

  const handleConfirmDisconnect = useCallback(() => {
    disconnectConfirm.confirm(async (id) => {
      try {
        await disconnectDevice.mutateAsync(id);
        showSuccess(t("detail.disconnected"));
      } catch {
        // Error surfaced by the mutation's onError toast.
      }
    });
  }, [disconnectConfirm, disconnectDevice, showSuccess, t]);

  const isConnected = device.status === "CONNECTED";

  return (
    <Flex direction="column" gap={5}>
      <PageHeader
        title={device.name}
        description={t("detail.description")}
        actions={
          <Button variant="ghost" onClick={() => navigate(ROUTE_PATHS.devices)}>
            <Icon>
              <FiArrowLeft />
            </Icon>
            {t("detail.back")}
          </Button>
        }
      />

      <SectionCard>
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          gap={4}
        >
          <SimpleGrid columns={{ base: 1, sm: 3 }} gap={5} flex="1">
            <Stack gap={1.5} align="flex-start">
              <Text fontSize="xs" color="text.secondary">
                {t("detail.statusLabel")}
              </Text>
              <Box>
                <DeviceStatusBadge status={device.status} />
              </Box>
            </Stack>
            <InfoRow
              label={t("detail.identifier")}
              value={
                device.identifier
                  ? formatPhoneDisplay(device.identifier)
                  : t("list.notPaired")
              }
            />
            <InfoRow
              label={t("detail.lastConnected")}
              value={
                device.lastConnectedAt
                  ? formatDateTime(device.lastConnectedAt)
                  : t("list.neverConnected")
              }
            />
          </SimpleGrid>

          <Flex gap={2} align="center">
            {isConnected ? (
              <Button
                variant="outline"
                onClick={() => disconnectConfirm.requestConfirm(device.id)}
              >
                <Icon>
                  <FiLogOut />
                </Icon>
                {t("detail.disconnect")}
              </Button>
            ) : (
              <Button onClick={qrModal.onOpen}>
                <Icon>
                  <FiZap />
                </Icon>
                {t("detail.connect")}
              </Button>
            )}
            <Button
              // The recipe's destructive outline; Chakra's generated types
              // don't know custom variant names.
              variant={"dangerOutline" as "outline"}
              onClick={() => deleteConfirm.requestConfirm(device.id)}
            >
              <Icon>
                <FiTrash2 />
              </Icon>
              {t("detail.delete")}
            </Button>
          </Flex>
        </Flex>
      </SectionCard>

      <DeviceWebhooksSection device={device} />

      <QrConnectModal
        isOpen={qrModal.open}
        onClose={qrModal.onClose}
        deviceId={device.id}
      />
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.cancel}
        onConfirm={handleConfirmDelete}
        title={t("detail.deleteConfirm.title")}
        description={t("detail.deleteConfirm.description")}
        confirmLabel={t("detail.delete")}
        isDanger
        isLoading={deleteDevice.isPending}
      />
      <ConfirmDialog
        isOpen={disconnectConfirm.isOpen}
        onClose={disconnectConfirm.cancel}
        onConfirm={handleConfirmDisconnect}
        title={t("detail.disconnectConfirm.title")}
        description={t("detail.disconnectConfirm.description")}
        confirmLabel={t("detail.disconnect")}
        isLoading={disconnectDevice.isPending}
      />
    </Flex>
  );
}

export function DeviceDetailPage() {
  const { id = "" } = useParams();
  const { data: device, isLoading, error } = useDeviceDetail(id);

  return (
    <DetailPageGuard
      isLoading={isLoading}
      error={error}
      entity={device}
      skeletonVariant="two-column"
    >
      {device && <DeviceDetailContent device={device} />}
    </DetailPageGuard>
  );
}
