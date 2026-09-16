import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  chakra,
  Flex,
  Icon,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiSmartphone } from "@/shared/components/icons";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { StatTiles } from "@/shared/components/ui/StatTiles";
import { FilterBar } from "@/shared/components/ui/FilterBar";
import { InlineSelect } from "@/shared/components/ui/InlineSelect";
import { ViewToggle, type ListView } from "@/shared/components/ui/ViewToggle";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog";
import { ListPageSkeleton } from "@/shared/components/skeletons/ListPageSkeleton";
import { useConfirm } from "@/shared/hooks/useConfirm";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useNotify } from "@/shared/hooks/useNotify";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useQueuedMessages } from "@/modules/messaging";
import { DeviceCard } from "@/modules/devices/presentation/components/DeviceCard";
import { DeviceRow } from "@/modules/devices/presentation/components/DeviceRow";
import { CreateDeviceModal } from "@/modules/devices/presentation/components/CreateDeviceModal";
import {
  useDevicesList,
  useDeleteDevice,
  useDisconnectDevice,
  usePrefetchDevice,
} from "@/modules/devices/presentation/hooks/useDevices";

type StatusFilter = "all" | "connected" | "disconnected" | "pairing";

const PAIRING_STATUSES = new Set(["QR_PENDING", "CONNECTING"]);

/** Cards or rows — a browser preference, remembered across visits. */
function useDevicesView(): [ListView, (view: ListView) => void] {
  const [view, setView] = useState<ListView>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.devicesView) === "list"
        ? "list"
        : "grid";
    } catch {
      // Private mode / blocked storage: fall back to the default.
      return "grid";
    }
  });

  const persist = useCallback((next: ListView) => {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEYS.devicesView, next);
    } catch {
      // The preference simply won't survive a reload.
    }
  }, []);

  return [view, persist];
}

export function DevicesListPage() {
  const { t } = useTranslation("devices");
  const navigate = useNavigate();
  const { showSuccess } = useNotify();

  const { data: devices = [], isLoading, isFetching } = useDevicesList();
  const { data: queue } = useQueuedMessages();
  const deleteDevice = useDeleteDevice();
  const disconnectDevice = useDisconnectDevice();
  const prefetchDevice = usePrefetchDevice();
  const createModal = useDisclosure();
  const deleteConfirm = useConfirm();
  const disconnectConfirm = useConfirm();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useDevicesView();

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
            : statusFilter === "pairing"
              ? PAIRING_STATUSES.has(device.status)
              : device.status !== "CONNECTED" &&
                !PAIRING_STATUSES.has(device.status);
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
          <Button
            variant="subtle"
            size="md"
            onClick={createModal.onOpen}
            data-cy="devices-add"
          >
            <Icon boxSize={3.5}>
              <FiPlus />
            </Icon>
            {t("list.add")}
          </Button>
        }
      />

      {isLoading ? (
        <ListPageSkeleton />
      ) : (
        <Flex direction="column" gap={6}>
          <StatTiles
            items={[
              { label: t("list.stats.total"), value: padCount(stats.total) },
              {
                label: t("list.stats.connected"),
                value: padCount(stats.connected),
                tone: "success",
              },
              {
                label: t("list.stats.disconnected"),
                value: padCount(stats.disconnected),
                tone: "error",
              },
              {
                label: t("list.stats.queued"),
                value: padCount(queue?.pending ?? 0),
                tone: "info",
              },
            ]}
          />

          {hasDevices && (
            <Flex gap={2.5} align="center" wrap="wrap">
              <Box flex={{ base: "1 1 100%", md: "1 1 240px" }} minW={0}>
                <FilterBar
                  searchValue={search}
                  onSearchChange={setSearch}
                  searchPlaceholder={t("list.searchPlaceholder")}
                  trailing={
                    <InlineSelect<StatusFilter>
                      value={statusFilter}
                      onChange={setStatusFilter}
                      ariaLabel={t("list.filter.label")}
                      dataCy="devices-status-filter"
                      options={[
                        { value: "all", label: t("list.filter.all") },
                        {
                          value: "connected",
                          label: t("list.filter.connected"),
                        },
                        {
                          value: "disconnected",
                          label: t("list.filter.disconnected"),
                        },
                        { value: "pairing", label: t("list.filter.pairing") },
                      ]}
                    />
                  }
                />
              </Box>
              <ViewToggle
                value={view}
                onChange={setView}
                gridLabel={t("list.view.grid")}
                listLabel={t("list.view.list")}
              />
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
            <Box opacity={isFetching ? 0.6 : 1} transition="opacity 150ms ease">
              {view === "grid" ? (
                <Box
                  display="grid"
                  gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))"
                  gap={3}
                  alignItems="stretch"
                >
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
                  <ConnectTile
                    label={t("list.connect.title")}
                    hint={t("list.connect.hint")}
                    onClick={createModal.onOpen}
                  />
                </Box>
              ) : (
                <Box
                  bg="bg.surface"
                  borderWidth="1px"
                  borderColor="border.default"
                  borderRadius="lg"
                  overflow="hidden"
                >
                  <Flex
                    px={4.5}
                    py={3}
                    gap={3.5}
                    borderBottomWidth="1px"
                    borderColor="border.default"
                    textStyle="eyebrow"
                    color="text.muted"
                  >
                    <Text flex={1} minW={0}>
                      {t("list.columns.device")}
                    </Text>
                    <Text
                      display={{ base: "none", md: "block" }}
                      w="132px"
                      flexShrink={0}
                    >
                      {t("list.columns.status")}
                    </Text>
                    <Box display={{ base: "none", md: "block" }} w="120px" />
                  </Flex>
                  {filtered.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      onOpen={handleOpen}
                      onHover={prefetchDevice}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    w="100%"
                    h="48px"
                    borderRadius="0"
                    borderTopWidth="1px"
                    borderColor="border.default"
                    bg="bg.canvas"
                    color="text.brand"
                    fontFamily="mono"
                    onClick={createModal.onOpen}
                  >
                    <Icon boxSize={3.5}>
                      <FiPlus />
                    </Icon>
                    {t("list.connect.title")}
                  </Button>
                </Box>
              )}
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

/** The counters read as fixed-width pairs (`03`), like the design. */
function padCount(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

interface ConnectTileProps {
  label: string;
  hint: string;
  onClick: () => void;
}

/** The dashed "connect a number" tile that closes the card grid. */
function ConnectTile({ label, hint, onClick }: ConnectTileProps) {
  return (
    <chakra.button
      type="button"
      data-cy="devices-connect-tile"
      onClick={onClick}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2.5}
      minH="150px"
      p={5}
      bg="transparent"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.accent"
      borderRadius="lg"
      color="text.brand"
      cursor="pointer"
      transition="background-color 150ms ease, border-color 150ms ease"
      _hover={{ bg: "bg.brand.subtle", borderColor: "border.brand" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "border.focus",
        outlineOffset: "2px",
      }}
    >
      <Icon boxSize={5}>
        <FiPlus />
      </Icon>
      <Text textStyle="mono" fontWeight="500" fontSize="13.5px">
        {label}
      </Text>
      <Text textStyle="mono" color="text.muted">
        {hint}
      </Text>
    </chakra.button>
  );
}
