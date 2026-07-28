import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositories } from "@/core/di/repositories";
import { queryKeys } from "@/core/query/queryKeys";
import { STALE_TIMES } from "@/core/query/staleTimes";
import { useErrorHandler } from "@/core/query/useErrorHandler";
import type {
  CreateDeviceInput,
  UpdateDeviceWebhooksInput,
} from "@/modules/devices/domain/entities/Device";

/** WhatsApp rotates the pairing QR roughly every few seconds; poll to match. */
const QR_POLL_INTERVAL_MS = 3_000;

/** The device list (GET /devices). Small, non-paginated per account. */
export function useDevicesList() {
  return useQuery({
    queryKey: queryKeys.devices.list(),
    queryFn: () => repositories.devices.list(),
  });
}

/** A single device's authoritative state (GET /devices/:id). */
export function useDeviceDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.devices.detail(id),
    queryFn: () => repositories.devices.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (input: CreateDeviceInput) =>
      repositories.devices.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.list() }),
    onError: (error) => handleError(error),
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (id: string) => repositories.devices.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.list() }),
    onError: (error) => handleError(error),
  });
}

export function useConnectDevice() {
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (id: string) => repositories.devices.connect(id),
    onError: (error) => handleError(error),
  });
}

export function useDisconnectDevice() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (id: string) => repositories.devices.disconnect(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.detail(result.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.list() });
    },
    onError: (error) => handleError(error),
  });
}

/**
 * Polls the pairing QR (GET /devices/:id/qr) while `enabled` (the connect modal
 * is open). The response carries the live `status`, so the modal reacts to
 * CONNECTED without a separate query.
 */
export function useDeviceQr(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.devices.qr(id),
    queryFn: () => repositories.devices.getQr(id),
    enabled: enabled && Boolean(id),
    refetchInterval: enabled ? QR_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    gcTime: 0,
  });
}

/**
 * The WhatsApp groups a connected device participates in (GET /devices/:id/groups).
 * Requires a live socket on the backend, so it's only enabled for a device the
 * caller knows is connected (the Sandbox gates on `enabled`). Not polled — the
 * list is fetched on demand when the group send flow is opened.
 */
export function useDeviceGroups(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.devices.groups(id),
    queryFn: () => repositories.devices.listGroups(id),
    enabled: enabled && Boolean(id),
    // Live-socket data (a device can join/leave groups); keep the dedup window
    // short so a reopened picker reflects reality without hammering the socket.
    staleTime: STALE_TIMES.volatile,
    // The endpoint 503s when the socket is down — a retry can't fix that, so
    // fail fast to the error state instead of 3 redundant round-trips.
    retry: false,
  });
}

export function useUpdateDeviceWebhooks(id: string) {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (input: UpdateDeviceWebhooksInput) =>
      repositories.devices.updateWebhooks(id, input),
    onSuccess: (device) => {
      queryClient.setQueryData(queryKeys.devices.detail(id), device);
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.list() });
    },
    onError: (error) => handleError(error),
  });
}
