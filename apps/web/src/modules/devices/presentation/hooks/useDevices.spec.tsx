import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mocked } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import { queryKeys } from "@/core/query/queryKeys";
import type {
  Device,
  DeviceGroup,
  DeviceQr,
} from "@/modules/devices/domain/entities/Device";
import type { DeviceRepository } from "@/modules/devices/domain/repositories/DeviceRepository";
import {
  useCreateDevice,
  useConnectDevice,
  useDeleteDevice,
  useDeviceDetail,
  useDeviceGroups,
  useDeviceQr,
  useDevicesList,
  useDisconnectDevice,
  usePrefetchDevice,
  useRefreshDevice,
  useUpdateDeviceWebhooks,
} from "./useDevices";

// Mock at the repository boundary: the hooks' contract is what they ask the
// repository for and what they do to the query cache with the answer.
const { devicesRepository, handleErrorMock } = vi.hoisted(() => ({
  devicesRepository: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    updateWebhooks: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getQr: vi.fn(),
    listGroups: vi.fn(),
    delete: vi.fn(),
  } as unknown as Mocked<DeviceRepository>,
  handleErrorMock: vi.fn(),
}));

vi.mock("@/core/di/repositories", () => ({
  repositories: { devices: devicesRepository },
}));

vi.mock("@/core/query/useErrorHandler", () => ({
  useErrorHandler: () => ({ handleError: handleErrorMock }),
}));

function makeDevice(id: string, overrides: Partial<Device> = {}): Device {
  return {
    id,
    name: `Device ${id}`,
    identifier: null,
    status: "DISCONNECTED",
    webhooks: {
      onConnect: null,
      onDisconnect: null,
      onReceive: null,
      onMessageStatus: null,
      onSend: null,
    },
    lastConnectedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const deviceA = makeDevice("a");
const deviceB = makeDevice("b");
const deviceC = makeDevice("c");
const deviceD = makeDevice("d");

/** A promise the test settles by hand, to observe the in-flight window. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createQueryClient(queries: DefaultOptions["queries"] = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, ...queries },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function listIds(queryClient: QueryClient) {
  return queryClient
    .getQueryData<Device[]>(queryKeys.devices.list())
    ?.map((device) => device.id);
}

function isInvalidated(queryClient: QueryClient, queryKey: readonly unknown[]) {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
}

function hasQuery(queryClient: QueryClient, queryKey: readonly unknown[]) {
  return (
    queryClient.getQueryCache().find({ queryKey, exact: true }) !== undefined
  );
}

let queryClient: QueryClient;

beforeEach(() => {
  vi.resetAllMocks();
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

describe("useDevicesList", () => {
  it("loads the device list from the repository", async () => {
    devicesRepository.list.mockResolvedValue([deviceA, deviceB]);

    const { result } = renderHook(() => useDevicesList(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([deviceA, deviceB]);
    expect(devicesRepository.list).toHaveBeenCalledTimes(1);
  });
});

describe("useDeviceDetail", () => {
  it("loads the device by id", async () => {
    devicesRepository.getById.mockResolvedValue(deviceB);

    const { result } = renderHook(() => useDeviceDetail("b"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(deviceB));
    expect(devicesRepository.getById).toHaveBeenCalledWith("b");
  });

  it("does not fetch while the id is empty", () => {
    const { result } = renderHook(() => useDeviceDetail(""), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(devicesRepository.getById).not.toHaveBeenCalled();
  });
});

describe("useCreateDevice", () => {
  it("returns the created device and invalidates the list", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA]);
    const created = { id: "new", webhookSecret: "whsec_once" };
    devicesRepository.create.mockResolvedValue(created);

    const { result } = renderHook(() => useCreateDevice(), {
      wrapper: createWrapper(queryClient),
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({ name: "Novo" });
    });

    expect(devicesRepository.create).toHaveBeenCalledWith({ name: "Novo" });
    expect(returned).toEqual(created);
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it("routes a failure to the error handler without touching the list", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA]);
    const failure = new Error("DEVICE_NAME_TAKEN");
    devicesRepository.create.mockRejectedValue(failure);

    const { result } = renderHook(() => useCreateDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate({ name: "Duplicado" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(handleErrorMock).toHaveBeenCalledWith(failure);
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(false);
  });
});

describe("usePrefetchDevice", () => {
  it("fills the detail cache from the repository", async () => {
    devicesRepository.getById.mockResolvedValue(deviceC);

    const { result } = renderHook(() => usePrefetchDevice(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current("c"));

    expect(devicesRepository.getById).toHaveBeenCalledWith("c");
    expect(queryClient.getQueryData(queryKeys.devices.detail("c"))).toEqual(
      deviceC,
    );
  });

  it("keeps a stable callback across re-renders", () => {
    const { result, rerender } = renderHook(() => usePrefetchDevice(), {
      wrapper: createWrapper(queryClient),
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

describe("useRefreshDevice", () => {
  it("invalidates only that device's detail and the list", () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB]);
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    queryClient.setQueryData(queryKeys.devices.detail("b"), deviceB);
    queryClient.setQueryData(queryKeys.devices.qr("a"), {
      status: "QR_PENDING",
      qr: "qr-a",
    });
    queryClient.setQueryData(queryKeys.devices.groups("a"), []);

    const { result } = renderHook(() => useRefreshDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current("a"));

    expect(isInvalidated(queryClient, queryKeys.devices.detail("a"))).toBe(
      true,
    );
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.devices.detail("b"))).toBe(
      false,
    );
    expect(isInvalidated(queryClient, queryKeys.devices.qr("a"))).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.devices.groups("a"))).toBe(
      false,
    );
  });

  it("refetches an observed detail after the invalidation", async () => {
    devicesRepository.getById
      .mockResolvedValueOnce(makeDevice("a", { status: "QR_PENDING" }))
      .mockResolvedValueOnce(makeDevice("a", { status: "CONNECTED" }));

    const { result } = renderHook(
      () => ({ detail: useDeviceDetail("a"), refresh: useRefreshDevice() }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() =>
      expect(result.current.detail.data?.status).toBe("QR_PENDING"),
    );

    act(() => result.current.refresh("a"));

    await waitFor(() =>
      expect(result.current.detail.data?.status).toBe("CONNECTED"),
    );
    expect(devicesRepository.getById).toHaveBeenCalledTimes(2);
  });
});

describe("useDeleteDevice", () => {
  it("removes the device from the list before the repository call resolves", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [
      deviceA,
      deviceB,
      deviceC,
    ]);
    const pending = deferred<void>();
    devicesRepository.delete.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("b"));

    await waitFor(() => expect(listIds(queryClient)).toEqual(["a", "c"]));
    expect(devicesRepository.delete).toHaveBeenCalledWith("b");
    expect(result.current.isPending).toBe(true);

    await act(async () => pending.resolve());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listIds(queryClient)).toEqual(["a", "c"]);
  });

  it("cancels an in-flight list fetch so a stale response cannot resurrect the device", async () => {
    const staleRefetch = deferred<Device[]>();
    devicesRepository.list
      .mockResolvedValueOnce([deviceA, deviceB, deviceC])
      .mockReturnValueOnce(staleRefetch.promise);
    const pendingDelete = deferred<void>();
    devicesRepository.delete.mockReturnValue(pendingDelete.promise);

    const { result } = renderHook(
      () => ({ list: useDevicesList(), remove: useDeleteDevice() }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    act(() => {
      void result.current.list.refetch();
    });
    await waitFor(() =>
      expect(
        queryClient.isFetching({ queryKey: queryKeys.devices.list() }),
      ).toBe(1),
    );

    act(() => result.current.remove.mutate("b"));
    await waitFor(() => expect(listIds(queryClient)).toEqual(["a", "c"]));

    await act(async () => staleRefetch.resolve([deviceA, deviceB, deviceC]));

    expect(listIds(queryClient)).toEqual(["a", "c"]);
  });

  it("puts a failed device back at its original position and reports the error", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [
      deviceA,
      deviceB,
      deviceC,
    ]);
    const failure = new Error("boom");
    devicesRepository.delete.mockRejectedValue(failure);

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("b"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(queryKeys.devices.list())).toEqual([
      deviceA,
      deviceB,
      deviceC,
    ]);
    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    expect(handleErrorMock).toHaveBeenCalledWith(failure);
  });

  it("restores only the failed device when another delete already removed a device", async () => {
    // A whole-snapshot rollback would bring B back here — this test pins the
    // per-device restore.
    queryClient.setQueryData(queryKeys.devices.list(), [
      deviceA,
      deviceB,
      deviceC,
      deviceD,
    ]);
    const deleteA = deferred<void>();
    const deleteB = deferred<void>();
    devicesRepository.delete.mockImplementation((id: string) =>
      id === "a" ? deleteA.promise : deleteB.promise,
    );

    const { result } = renderHook(
      () => ({ first: useDeleteDevice(), second: useDeleteDevice() }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => result.current.first.mutate("a"));
    await waitFor(() => expect(listIds(queryClient)).toEqual(["b", "c", "d"]));

    act(() => result.current.second.mutate("b"));
    await waitFor(() => expect(listIds(queryClient)).toEqual(["c", "d"]));

    await act(async () => deleteB.resolve());
    await waitFor(() => expect(result.current.second.isSuccess).toBe(true));

    const failure = new Error("A could not be deleted");
    await act(async () => deleteA.reject(failure));
    await waitFor(() => expect(result.current.first.isError).toBe(true));

    expect(listIds(queryClient)).toEqual(["a", "c", "d"]);
    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    expect(handleErrorMock).toHaveBeenCalledWith(failure);
  });

  it("keeps the failed device after the devices that preceded it when neighbours changed", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [
      deviceA,
      deviceB,
      deviceC,
    ]);
    const pending = deferred<void>();
    devicesRepository.delete.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("b"));
    await waitFor(() => expect(listIds(queryClient)).toEqual(["a", "c"]));

    // A device arrives at the front while the delete is in flight.
    act(() => {
      queryClient.setQueryData<Device[]>(queryKeys.devices.list(), (devices) => [
        deviceD,
        ...(devices ?? []),
      ]);
    });

    await act(async () => pending.reject(new Error("boom")));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(listIds(queryClient)).toEqual(["d", "a", "b", "c"]);
  });

  it("does not duplicate a failed device that is already back in the list", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB]);
    const pending = deferred<void>();
    devicesRepository.delete.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("b"));
    await waitFor(() => expect(listIds(queryClient)).toEqual(["a"]));

    act(() => {
      queryClient.setQueryData(queryKeys.devices.list(), [deviceB, deviceA]);
    });

    await act(async () => pending.reject(new Error("boom")));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(listIds(queryClient)).toEqual(["b", "a"]);
  });

  it("removes the deleted device's detail, qr and groups caches on success", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB]);
    queryClient.setQueryData(queryKeys.devices.detail("b"), deviceB);
    queryClient.setQueryData<DeviceQr>(queryKeys.devices.qr("b"), {
      status: "QR_PENDING",
      qr: "qr-b",
    });
    queryClient.setQueryData<DeviceGroup[]>(queryKeys.devices.groups("b"), [
      { jid: "1@g.us", name: "Grupo" },
    ]);
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    queryClient.setQueryData<DeviceQr>(queryKeys.devices.qr("a"), {
      status: "QR_PENDING",
      qr: "qr-a",
    });
    devicesRepository.delete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync("b"));

    expect(hasQuery(queryClient, queryKeys.devices.detail("b"))).toBe(false);
    expect(hasQuery(queryClient, queryKeys.devices.qr("b"))).toBe(false);
    expect(hasQuery(queryClient, queryKeys.devices.groups("b"))).toBe(false);
    expect(queryClient.getQueryData(queryKeys.devices.detail("a"))).toEqual(
      deviceA,
    );
    expect(hasQuery(queryClient, queryKeys.devices.qr("a"))).toBe(true);
  });

  it("keeps a detail query that still has a mounted observer", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB]);
    queryClient.setQueryData<DeviceQr>(queryKeys.devices.qr("b"), {
      status: "DISCONNECTED",
      qr: null,
    });
    devicesRepository.getById.mockResolvedValue(deviceB);
    devicesRepository.delete.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => ({ detail: useDeviceDetail("b"), remove: useDeleteDevice() }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.detail.data).toEqual(deviceB));

    await act(() => result.current.remove.mutateAsync("b"));

    expect(hasQuery(queryClient, queryKeys.devices.detail("b"))).toBe(true);
    expect(result.current.detail.data).toEqual(deviceB);
    expect(hasQuery(queryClient, queryKeys.devices.qr("b"))).toBe(false);
    // The observer did not trigger a refetch of the deleted device.
    expect(devicesRepository.getById).toHaveBeenCalledTimes(1);
  });

  it("leaves the per-device caches alone when the delete fails", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceB]);
    queryClient.setQueryData(queryKeys.devices.detail("b"), deviceB);
    queryClient.setQueryData<DeviceGroup[]>(queryKeys.devices.groups("b"), []);
    devicesRepository.delete.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("b"));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(queryKeys.devices.detail("b"))).toEqual(
      deviceB,
    );
    expect(hasQuery(queryClient, queryKeys.devices.groups("b"))).toBe(true);
  });

  it("invalidates the list once the delete settles, on success and on failure", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB]);
    devicesRepository.delete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useDeleteDevice(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync("a"));
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);

    // Reset the flag so the failure path has to set it again.
    act(() => {
      queryClient.setQueryData(queryKeys.devices.list(), [deviceB]);
    });
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(false);

    act(() => result.current.mutate("b"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);
    expect(listIds(queryClient)).toEqual(["b"]);
  });

  it("waits for the last overlapping delete before invalidating the list", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB, deviceC]);
    let finishA!: () => void;
    let finishB!: () => void;
    devicesRepository.delete
      .mockImplementationOnce(() => new Promise<void>((done) => (finishA = done)))
      .mockImplementationOnce(() => new Promise<void>((done) => (finishB = done)));

    const { result } = renderHook(
      () => ({ first: useDeleteDevice(), second: useDeleteDevice() }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => result.current.first.mutate("a"));
    act(() => result.current.second.mutate("b"));
    await waitFor(() => expect(listIds(queryClient)).toEqual(["c"]));

    // B settles first while A is still in flight: no refetch yet, or a stale
    // server list could bring A back.
    await act(async () => finishB());
    await waitFor(() => expect(result.current.second.isSuccess).toBe(true));
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(false);

    await act(async () => finishA());
    await waitFor(() => expect(result.current.first.isSuccess).toBe(true));
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);
  });

  it("refetches a mounted list after the delete settles", async () => {
    devicesRepository.list
      .mockResolvedValueOnce([deviceA, deviceB])
      .mockResolvedValueOnce([deviceA]);
    devicesRepository.delete.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => ({ list: useDevicesList(), remove: useDeleteDevice() }),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.remove.mutateAsync("b"));

    await waitFor(() =>
      expect(devicesRepository.list).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(result.current.list.data).toEqual([deviceA]),
    );
  });
});

describe("useConnectDevice", () => {
  it("asks the repository to connect and returns its answer", async () => {
    devicesRepository.connect.mockResolvedValue({
      id: "a",
      status: "CONNECTING",
    });

    const { result } = renderHook(() => useConnectDevice(), {
      wrapper: createWrapper(queryClient),
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync("a");
    });

    expect(devicesRepository.connect).toHaveBeenCalledWith("a");
    expect(returned).toEqual({ id: "a", status: "CONNECTING" });
  });

  it("routes a failure to the error handler", async () => {
    const failure = new Error("offline");
    devicesRepository.connect.mockRejectedValue(failure);

    const { result } = renderHook(() => useConnectDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("a"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(handleErrorMock).toHaveBeenCalledWith(failure);
  });
});

describe("useDisconnectDevice", () => {
  it("invalidates the returned device's detail and the list", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA, deviceB]);
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    queryClient.setQueryData(queryKeys.devices.detail("b"), deviceB);
    devicesRepository.disconnect.mockResolvedValue({
      id: "b",
      status: "DISCONNECTED",
    });

    const { result } = renderHook(() => useDisconnectDevice(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync("b"));

    expect(devicesRepository.disconnect).toHaveBeenCalledWith("b");
    expect(isInvalidated(queryClient, queryKeys.devices.detail("b"))).toBe(
      true,
    );
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);
    expect(isInvalidated(queryClient, queryKeys.devices.detail("a"))).toBe(
      false,
    );
  });

  it("targets the id the server returned, not the one that was sent", async () => {
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    queryClient.setQueryData(queryKeys.devices.detail("b"), deviceB);
    devicesRepository.disconnect.mockResolvedValue({
      id: "a",
      status: "DISCONNECTED",
    });

    const { result } = renderHook(() => useDisconnectDevice(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync("b"));

    expect(isInvalidated(queryClient, queryKeys.devices.detail("a"))).toBe(
      true,
    );
    expect(isInvalidated(queryClient, queryKeys.devices.detail("b"))).toBe(
      false,
    );
  });

  it("routes a failure to the error handler without invalidating anything", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA]);
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    const failure = new Error("boom");
    devicesRepository.disconnect.mockRejectedValue(failure);

    const { result } = renderHook(() => useDisconnectDevice(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate("a"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(handleErrorMock).toHaveBeenCalledWith(failure);
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(false);
    expect(isInvalidated(queryClient, queryKeys.devices.detail("a"))).toBe(
      false,
    );
  });
});

describe("useDeviceQr", () => {
  const pendingQr: DeviceQr = { status: "QR_PENDING", qr: "qr-payload" };

  it("does not fetch while disabled", () => {
    const { result } = renderHook(() => useDeviceQr("a", false), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(devicesRepository.getQr).not.toHaveBeenCalled();
  });

  it("does not fetch for an empty id even when enabled", () => {
    const { result } = renderHook(() => useDeviceQr("", true), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(devicesRepository.getQr).not.toHaveBeenCalled();
  });

  it("fetches the pairing QR when enabled", async () => {
    devicesRepository.getQr.mockResolvedValue(pendingQr);

    const { result } = renderHook(() => useDeviceQr("a", true), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(pendingQr));
    expect(devicesRepository.getQr).toHaveBeenCalledWith("a");
  });

  it("starts fetching once it becomes enabled", async () => {
    devicesRepository.getQr.mockResolvedValue(pendingQr);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDeviceQr("a", enabled),
      { wrapper: createWrapper(queryClient), initialProps: { enabled: false } },
    );
    expect(devicesRepository.getQr).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toEqual(pendingQr));
  });

  it("drops the cached QR as soon as nothing observes it", async () => {
    devicesRepository.getQr.mockResolvedValue(pendingQr);

    const { result, unmount } = renderHook(() => useDeviceQr("a", true), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.data).toEqual(pendingQr));
    expect(hasQuery(queryClient, queryKeys.devices.qr("a"))).toBe(true);

    unmount();

    await waitFor(() =>
      expect(hasQuery(queryClient, queryKeys.devices.qr("a"))).toBe(false),
    );
  });

  describe("polling", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("polls the QR every 3 seconds while enabled", async () => {
      devicesRepository.getQr.mockResolvedValue(pendingQr);

      renderHook(() => useDeviceQr("a", true), {
        wrapper: createWrapper(queryClient),
      });
      await waitFor(() =>
        expect(devicesRepository.getQr).toHaveBeenCalledTimes(1),
      );

      await act(() => vi.advanceTimersByTimeAsync(3_000));
      await waitFor(() =>
        expect(devicesRepository.getQr).toHaveBeenCalledTimes(2),
      );

      await act(() => vi.advanceTimersByTimeAsync(3_000));
      await waitFor(() =>
        expect(devicesRepository.getQr).toHaveBeenCalledTimes(3),
      );
    });

    it("stops polling once disabled", async () => {
      devicesRepository.getQr.mockResolvedValue(pendingQr);

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useDeviceQr("a", enabled),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { enabled: true },
        },
      );
      await waitFor(() =>
        expect(devicesRepository.getQr).toHaveBeenCalledTimes(1),
      );

      rerender({ enabled: false });
      await act(() => vi.advanceTimersByTimeAsync(10_000));

      expect(devicesRepository.getQr).toHaveBeenCalledTimes(1);
    });
  });
});

describe("useDeviceGroups", () => {
  const groups: DeviceGroup[] = [{ jid: "123@g.us", name: "Equipe" }];

  it("does not fetch unless enabled", () => {
    const { result } = renderHook(() => useDeviceGroups("a", false), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(devicesRepository.listGroups).not.toHaveBeenCalled();
  });

  it("does not fetch for an empty id even when enabled", () => {
    const { result } = renderHook(() => useDeviceGroups("", true), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(devicesRepository.listGroups).not.toHaveBeenCalled();
  });

  it("loads the device's groups when enabled", async () => {
    devicesRepository.listGroups.mockResolvedValue(groups);

    const { result } = renderHook(() => useDeviceGroups("a", true), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(groups));
    expect(devicesRepository.listGroups).toHaveBeenCalledWith("a");
  });

  it("fails fast without retrying even when the client retries by default", async () => {
    // A client that DOES retry, so the hook's own `retry: false` is what is
    // being exercised (the shared test client disables retries globally).
    const retryingClient = createQueryClient({ retry: 2, retryDelay: 0 });
    devicesRepository.listGroups.mockRejectedValue(new Error("DEVICE_OFFLINE"));
    devicesRepository.getById.mockRejectedValue(new Error("flaky"));

    const { result } = renderHook(
      () => ({
        groups: useDeviceGroups("a", true),
        control: useDeviceDetail("a"),
      }),
      { wrapper: createWrapper(retryingClient) },
    );

    await waitFor(() => expect(result.current.groups.isError).toBe(true));
    expect(devicesRepository.listGroups).toHaveBeenCalledTimes(1);

    // Control: a query without the override is retried by this client.
    await waitFor(() => expect(result.current.control.isError).toBe(true));
    expect(devicesRepository.getById).toHaveBeenCalledTimes(3);

    retryingClient.clear();
  });
});

describe("useUpdateDeviceWebhooks", () => {
  it("stores the returned device in the detail cache and invalidates the list", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA]);
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    const updated = makeDevice("a", {
      webhooks: { ...deviceA.webhooks, onConnect: "https://hooks.test/c" },
    });
    devicesRepository.updateWebhooks.mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateDeviceWebhooks("a"), {
      wrapper: createWrapper(queryClient),
    });

    await act(() =>
      result.current.mutateAsync({ onConnect: "https://hooks.test/c" }),
    );

    expect(devicesRepository.updateWebhooks).toHaveBeenCalledWith("a", {
      onConnect: "https://hooks.test/c",
    });
    expect(queryClient.getQueryData(queryKeys.devices.detail("a"))).toEqual(
      updated,
    );
    // Written, not invalidated: no refetch round-trip for data we just got.
    expect(isInvalidated(queryClient, queryKeys.devices.detail("a"))).toBe(
      false,
    );
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(true);
  });

  it("routes a failure to the error handler and keeps the cached detail", async () => {
    queryClient.setQueryData(queryKeys.devices.list(), [deviceA]);
    queryClient.setQueryData(queryKeys.devices.detail("a"), deviceA);
    const failure = new Error("VALIDATION_ERROR");
    devicesRepository.updateWebhooks.mockRejectedValue(failure);

    const { result } = renderHook(() => useUpdateDeviceWebhooks("a"), {
      wrapper: createWrapper(queryClient),
    });

    act(() => result.current.mutate({ onSend: "not-a-url" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(handleErrorMock).toHaveBeenCalledWith(failure);
    expect(queryClient.getQueryData(queryKeys.devices.detail("a"))).toBe(
      deviceA,
    );
    expect(isInvalidated(queryClient, queryKeys.devices.list())).toBe(false);
  });
});
