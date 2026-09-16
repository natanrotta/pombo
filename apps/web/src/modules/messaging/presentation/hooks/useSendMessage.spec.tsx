import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorCodes } from "@pombo/shared-types";
import { AppError } from "@/core/errors/AppError";
import { queryKeys } from "@/core/query/queryKeys";
import type {
  MessageStatus,
  MessageStatusResult,
  SendMessageResult,
} from "@/modules/messaging/domain/entities/Message";
import type { SendMessageArgs } from "./useSendMessage";

// Hoisted so the `vi.mock` factories below can hand out the same instances the
// assertions read (the factories run before this module's body).
const { messaging, handleErrorMock } = vi.hoisted(() => ({
  messaging: {
    sendText: vi.fn(),
    sendGroupText: vi.fn(),
    sendImage: vi.fn(),
    sendAudio: vi.fn(),
    sendVideo: vi.fn(),
    sendDocument: vi.fn(),
    getStatus: vi.fn(),
  },
  handleErrorMock: vi.fn(),
}));

vi.mock("@/core/di/repositories", () => ({
  repositories: { messaging },
}));

vi.mock("@/core/query/useErrorHandler", () => ({
  useErrorHandler: () => ({ handleError: handleErrorMock }),
}));

const { useSendMessage, useMessageStatus } = await import("./useSendMessage");

/** No default `gcTime` / `staleTime` here: the hook's own options are what's
 *  under test. Retries are off so an error settles on the first attempt. */
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

const accepted: SendMessageResult = { messageId: "msg-1", status: "PENDING" };

const statusOf = (status: MessageStatus): MessageStatusResult => ({
  messageId: "msg-1",
  status,
  failureReason: status === "FAILED" ? "boom" : null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSendMessage", () => {
  const cases: Array<{
    args: SendMessageArgs;
    method: keyof typeof messaging;
  }> = [
    {
      args: {
        deviceId: "dev-1",
        type: "text",
        input: { phone: "5511999998888", text: "Olá" },
      },
      method: "sendText",
    },
    {
      args: {
        deviceId: "dev-1",
        type: "group",
        input: { groupJid: "123@g.us", text: "Olá grupo" },
      },
      method: "sendGroupText",
    },
    {
      args: {
        deviceId: "dev-1",
        type: "image",
        input: { phone: "5511999998888", image: "https://cdn.test/a.png" },
      },
      method: "sendImage",
    },
    {
      args: {
        deviceId: "dev-1",
        type: "audio",
        input: { phone: "5511999998888", audio: "https://cdn.test/a.ogg" },
      },
      method: "sendAudio",
    },
    {
      args: {
        deviceId: "dev-1",
        type: "video",
        input: { phone: "5511999998888", video: "https://cdn.test/a.mp4" },
      },
      method: "sendVideo",
    },
    {
      args: {
        deviceId: "dev-1",
        type: "document",
        input: {
          phone: "5511999998888",
          document: "https://cdn.test/a.pdf",
          fileName: "a.pdf",
        },
      },
      method: "sendDocument",
    },
  ];

  it.each(cases)(
    "dispatches a $args.type send to repository.$method",
    async ({ args, method }) => {
      messaging[method].mockResolvedValue(accepted);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSendMessage(), { wrapper });

      let returned: unknown;
      await act(async () => {
        returned = await result.current.mutateAsync(args);
      });

      expect(returned).toEqual(accepted);
      expect(messaging[method]).toHaveBeenCalledTimes(1);
      expect(messaging[method]).toHaveBeenCalledWith(args.deviceId, args.input);
      for (const other of Object.keys(messaging) as Array<
        keyof typeof messaging
      >) {
        if (other !== method) expect(messaging[other]).not.toHaveBeenCalled();
      }
    },
  );

  it("hands a failed send to the shared error handler and still rejects", async () => {
    const error = new AppError(
      "Número não está no WhatsApp",
      ErrorCodes.NUMBER_NOT_ON_WHATSAPP,
      422,
    );
    messaging.sendText.mockRejectedValue(error);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync(cases[0]!.args),
      ).rejects.toBe(error);
    });

    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    expect(handleErrorMock).toHaveBeenCalledWith(error);
  });

  it("does not call the error handler on success", async () => {
    messaging.sendText.mockResolvedValue(accepted);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(cases[0]!.args);
    });

    expect(handleErrorMock).not.toHaveBeenCalled();
  });
});

describe("useMessageStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Only the poll interval is faked: TanStack delivers query updates through a
   *  `setTimeout(0)`, which must stay real so a fetch can settle between ticks. */
  const fakePollInterval = () =>
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

  const nextMacrotask = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

  /** Moves the poll clock forward, then lets any fetch it fired settle. */
  const advance = (ms: number) =>
    act(async () => {
      vi.advanceTimersByTime(ms);
      await nextMacrotask();
      await nextMacrotask();
    });

  it("does not fetch without a message id", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMessageStatus(null, true), {
      wrapper,
    });

    await act(async () => {});

    expect(messaging.getStatus).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("does not fetch while disabled", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMessageStatus("msg-1", false), {
      wrapper,
    });

    await act(async () => {});

    expect(messaging.getStatus).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches the status of the given message once enabled", async () => {
    messaging.getStatus.mockResolvedValue(statusOf("SERVER_ACK"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMessageStatus("msg-1", true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(messaging.getStatus).toHaveBeenCalledWith("msg-1");
    expect(result.current.data).toEqual(statusOf("SERVER_ACK"));
  });

  it.each(["READ", "FAILED"] as const)(
    "polls every 2s and stops once the status reaches %s",
    async (terminal) => {
      fakePollInterval();
      messaging.getStatus
        .mockResolvedValueOnce(statusOf("PENDING"))
        .mockResolvedValueOnce(statusOf("DELIVERY_ACK"))
        .mockResolvedValue(statusOf(terminal));
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useMessageStatus("msg-1", true), {
        wrapper,
      });

      await advance(0);
      expect(messaging.getStatus).toHaveBeenCalledTimes(1);
      expect(result.current.data?.status).toBe("PENDING");

      await advance(1_999);
      expect(messaging.getStatus).toHaveBeenCalledTimes(1);

      await advance(1);
      expect(messaging.getStatus).toHaveBeenCalledTimes(2);
      expect(result.current.data?.status).toBe("DELIVERY_ACK");

      await advance(2_000);
      expect(messaging.getStatus).toHaveBeenCalledTimes(3);
      expect(result.current.data?.status).toBe(terminal);

      await advance(20_000);
      expect(messaging.getStatus).toHaveBeenCalledTimes(3);
    },
  );

  it("stops polling after a hard error", async () => {
    fakePollInterval();
    messaging.getStatus.mockRejectedValue(
      new AppError("Mensagem não encontrada", ErrorCodes.MESSAGE_NOT_FOUND, 404),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMessageStatus("msg-1", true), {
      wrapper,
    });

    await advance(0);
    expect(result.current.isError).toBe(true);
    expect(messaging.getStatus).toHaveBeenCalledTimes(1);

    await advance(20_000);
    expect(messaging.getStatus).toHaveBeenCalledTimes(1);
  });

  it("evicts the cached status as soon as the consumer unmounts", async () => {
    messaging.getStatus.mockResolvedValue(statusOf("READ"));
    const { client, wrapper } = createWrapper();
    const { result, unmount } = renderHook(
      () => useMessageStatus("msg-1", true),
      { wrapper },
    );
    const queryKey = queryKeys.messaging.messageStatus("msg-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryCache().find({ queryKey })?.gcTime).toBe(0);

    unmount();

    await waitFor(() =>
      expect(client.getQueryCache().find({ queryKey })).toBeUndefined(),
    );
  });
});
