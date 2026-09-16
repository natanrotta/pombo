import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositories } from "@/core/di/repositories";
import { queryKeys } from "@/core/query/queryKeys";
import { STALE_TIMES } from "@/core/query/staleTimes";
import { useErrorHandler } from "@/core/query/useErrorHandler";
import type {
  CreateDeviceInput,
  Device,
  UpdateDeviceWebhooksInput,
} from "@/modules/devices/domain/entities/Device";

/** WhatsApp rotates the pairing QR roughly every few seconds; poll to match. */
const QR_POLL_INTERVAL_MS = 3_000;

/** The device list (GET /devices). Small, non-paginated per account. */
export function useDevicesList() {
  return useQuery({
    queryKey: queryKeys.devices.list(),
    queryFn: ({ signal }) => repositories.devices.list(signal),
  });
}

/** A single device's authoritative state (GET /devices/:id). */
export function useDeviceDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.devices.detail(id),
    queryFn: ({ signal }) => repositories.devices.getById(id, signal),
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

/** Pre-warms a device's detail cache (card hover/focus → detail page). */
export function usePrefetchDevice() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.devices.detail(id),
        queryFn: ({ signal }) => repositories.devices.getById(id, signal),
      }),
    [queryClient],
  );
}

/** Refetches a device's detail and the list after an out-of-band change
 *  (e.g. the pairing QR reported CONNECTED). */
export function useRefreshDevice() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.list() });
    },
    [queryClient],
  );
}

/** Re-inserts `id` (taken from `previous`) into `current` right after the
 *  devices that preceded it; no-op when it is already there or unknown. */
function restoreDevice(
  current: Device[],
  previous: Device[],
  id: string,
): Device[] {
  const position = previous.findIndex((device) => device.id === id);
  if (position === -1 || current.some((device) => device.id === id)) {
    return current;
  }
  const precedingIds = new Set(
    previous.slice(0, position).map((device) => device.id),
  );
  let insertAt = 0;
  current.forEach((device, index) => {
    if (precedingIds.has(device.id)) insertAt = index + 1;
  });
  return [
    ...current.slice(0, insertAt),
    previous[position],
    ...current.slice(insertAt),
  ];
}

const DELETE_DEVICE_MUTATION_KEY = ["devices", "delete"] as const;

/** Optimistic: the device leaves the list at once and comes back on failure. */
export function useDeleteDevice() {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationKey: DELETE_DEVICE_MUTATION_KEY,
    mutationFn: (id: string) => repositories.devices.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.devices.list() });
      const previous = queryClient.getQueryData<Device[]>(
        queryKeys.devices.list(),
      );
      queryClient.setQueryData<Device[]>(queryKeys.devices.list(), (devices) =>
        devices?.filter((device) => device.id !== id),
      );
      return { previous };
    },
    onError: (error, id, context) => {
      // Put back only the failed device: restoring the whole snapshot would
      // also resurrect a device another in-flight delete already removed.
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<Device[]>(queryKeys.devices.list(), (current) =>
          current ? restoreDevice(current, previous, id) : previous,
        );
      }
      handleError(error);
    },
    onSuccess: (_result, id) => {
      // Inactive only: an observer still mounted (the detail page navigating
      // away) would refetch a removed query and hit a 404.
      for (const queryKey of [
        queryKeys.devices.detail(id),
        queryKeys.devices.qr(id),
        queryKeys.devices.groups(id),
      ]) {
        queryClient.removeQueries({ queryKey, type: "inactive" });
      }
    },
    onSettled: () => {
      // Refetch only when the last overlapping delete settles: an earlier
      // refetch could bring back a device whose delete is still in flight.
      // (This mutation still counts as pending while its onSettled runs.)
      const pendingDeletes = queryClient.isMutating({
        mutationKey: DELETE_DEVICE_MUTATION_KEY,
      });
      if (pendingDeletes > 1) return;
      return queryClient.invalidateQueries({
        queryKey: queryKeys.devices.list(),
      });
    },
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
    queryFn: ({ signal }) => repositories.devices.getQr(id, signal),
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
    queryFn: ({ signal }) => repositories.devices.listGroups(id, signal),
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
