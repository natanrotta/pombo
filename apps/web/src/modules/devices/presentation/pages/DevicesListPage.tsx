import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  Icon,
  SimpleGrid,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiPlus,
  FiSlash,
  FiSmartphone,
} from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { StatCard } from "@/shared/components/ui/StatCard";
import { FilterBar } from "@/shared/components/ui/FilterBar";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { ListPageSkeleton } from "@/shared/components/skeletons/ListPageSkeleton";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useNotify } from "@/shared/hooks/useNotify";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { DeviceCard } from "@/modules/devices/presentation/components/DeviceCard";
import { CreateDeviceModal } from "@/modules/devices/presentation/components/CreateDeviceModal";
import {
  useDevicesList,
  useDeleteDevice,
  useDisconnectDevice,
  usePrefetchDevice,
} from "@/modules/devices/presentation/hooks/useDevices";

type StatusFilter = "all" | "connected" | "disconnected";

export function DevicesListPage() {
  const { t } = useTranslation("devices");
  const navigate = useNavigate();
  const { showSuccess } = useNotify();

  const { data: devices = [], isLoading, isFetching } = useDevicesList();
  const deleteDevice = useDeleteDevice();
  const disconnectDevice = useDisconnectDevice();
  const prefetchDevice = usePrefetchDevice();
  const createModal = useDisclosure();
  const deleteConfirm = useConfirm();
  const disconnectConfirm = useConfirm();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const stats = useMemo(() => {
    const total = devices.length;
    const connected = devices.filter((d) => d.status === "CONNECTED").length;
    return { total, connected, disconnected: total - connected };
  }, [devices]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return devices.filter((device) => {
      const matchesSearch =
        q === "" ||
        device.name.toLowerCase().includes(q) ||
        (device.identifier ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "connected"
            ? device.status === "CONNECTED"
            : device.status !== "CONNECTED";
      return matchesSearch && matchesStatus;
    });
  }, [devices, debouncedSearch, statusFilter]);

  const handleOpen = useCallback(
    (id: string) => navigate(ROUTE_PATHS.deviceDetail.replace(":id", id)),
    [navigate],
  );
  const handleDelete = useCallback(
    (id: string) => deleteConfirm.requestConfirm(id),
    [deleteConfirm],
  );
  const handleConfirmDelete = useCallback(() => {
    deleteConfirm.confirm(async (id) => {
      try {
        await deleteDevice.mutateAsync(id);
        showSuccess(t("list.deleted"));
      } catch {
        // Error surfaced by the mutation's onError toast.
      }
    });
  }, [deleteConfirm, deleteDevice, showSuccess, t]);
  const handleDisconnect = useCallback(
    (id: string) => disconnectConfirm.requestConfirm(id),
    [disconnectConfirm],
  );
  const handleConfirmDisconnect = useCallback(() => {
    disconnectConfirm.confirm(async (id) => {
      try {
        await disconnectDevice.mutateAsync(id);
        showSuccess(t("list.disconnected"));
      } catch {
        // Error surfaced by the mutation's onError toast.
      }
    });
  }, [disconnectConfirm, disconnectDevice, showSuccess, t]);

  const hasDevices = devices.length > 0;

  return (
    <>
      <PageHeader
        title={t("list.title")}
        description={t("list.description")}
        actions={
          <Button onClick={createModal.onOpen} data-cy="devices-add">
            <Icon>
              <FiPlus />
            </Icon>
            {t("list.add")}
          </Button>
        }
      />

      {isLoading ? (
        <ListPageSkeleton />
      ) : (
        <Flex direction="column" gap={5}>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
            <StatCard
              label={t("list.stats.total")}
              value={String(stats.total)}
              hint={t("list.stats.totalHint")}
              icon={FiSmartphone}
              tone="blue"
            />
            <StatCard
              label={t("list.stats.connected")}
              value={String(stats.connected)}
              hint={t("list.stats.connectedHint")}
              icon={FiCheckCircle}
              tone="success"
            />
            <StatCard
              label={t("list.stats.disconnected")}
              value={String(stats.disconnected)}
              hint={t("list.stats.disconnectedHint")}
              icon={FiSlash}
              tone="error"
            />
          </SimpleGrid>

          {hasDevices && (
            <Flex
              direction={{ base: "column", md: "row" }}
              gap={3}
              align={{ base: "stretch", md: "center" }}
              justify="space-between"
            >
              <Box flex="1">
                <FilterBar
                  searchValue={search}
                  onSearchChange={setSearch}
                  searchPlaceholder={t("list.searchPlaceholder")}
                />
              </Box>
              <ButtonGroup size="sm" attached variant="outline">
                {(["all", "connected", "disconnected"] as StatusFilter[]).map(
                  (value) => (
                    <Button
                      key={value}
                      variant={statusFilter === value ? "solid" : "outline"}
                      onClick={() => setStatusFilter(value)}
                    >
                      {t(`list.filter.${value}`)}
                    </Button>
                  ),
                )}
              </ButtonGroup>
            </Flex>
          )}

          {!hasDevices ? (
            <EmptyState
              icon={FiSmartphone}
              title={t("list.empty.title")}
              description={t("list.empty.description")}
              actionLabel={t("list.add")}
              onAction={createModal.onOpen}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FiSmartphone}
              title={t("list.noResults.title")}
              description={t("list.noResults.description")}
              size="sm"
            />
          ) : (
            <Box opacity={isFetching ? 0.6 : 1} transition="opacity 0.15s ease">
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
                {filtered.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onOpen={handleOpen}
                    onHover={prefetchDevice}
                    onDelete={handleDelete}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}
        </Flex>
      )}

      <CreateDeviceModal
        isOpen={createModal.open}
        onClose={createModal.onClose}
      />
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.cancel}
        onConfirm={handleConfirmDelete}
        title={t("list.deleteConfirm.title")}
        description={t("list.deleteConfirm.description")}
        confirmLabel={t("list.delete")}
        isDanger
        isLoading={deleteDevice.isPending}
      />
      <ConfirmDialog
        isOpen={disconnectConfirm.isOpen}
        onClose={disconnectConfirm.cancel}
        onConfirm={handleConfirmDisconnect}
        title={t("list.disconnectConfirm.title")}
        description={t("list.disconnectConfirm.description")}
        confirmLabel={t("list.disconnect")}
        isLoading={disconnectDevice.isPending}
      />
    </>
  );
}
