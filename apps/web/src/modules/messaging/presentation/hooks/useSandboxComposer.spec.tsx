import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { ErrorCodes } from "@pombo/shared-types";
import i18n from "@/shared/i18n";
import { AppError } from "@/core/errors/AppError";
import type { Device } from "@/modules/devices";
import type { SendMessageResult } from "@/modules/messaging/domain/entities/Message";
import type { SendMessageArgs } from "@/modules/messaging/presentation/hooks/useSendMessage";
import {
  INITIAL_SANDBOX_FORM,
  PHONE_NOT_ON_WHATSAPP,
} from "@/modules/messaging/presentation/utils/sandboxForm";

const { sendMock, addRecipientMock, removeRecipientMock, showSuccessMock } =
  vi.hoisted(() => ({
    sendMock: vi.fn<[SendMessageArgs], Promise<SendMessageResult>>(),
    addRecipientMock: vi.fn(),
    removeRecipientMock: vi.fn(),
    showSuccessMock: vi.fn(),
  }));

vi.mock("@/modules/messaging/presentation/hooks/useSendMessage", () => ({
  useSendMessage: () => ({ mutateAsync: sendMock }),
}));

vi.mock("@/modules/messaging/presentation/hooks/useRecentRecipients", () => ({
  useRecentRecipients: () => ({
    recents: ["5511999990001"],
    addRecipient: addRecipientMock,
    removeRecipient: removeRecipientMock,
  }),
}));

vi.mock("@/shared/hooks/useNotify", () => ({
  useNotify: () => ({
    showSuccess: showSuccessMock,
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
    showAutoSaved: vi.fn(),
  }),
}));

const { useSandboxComposer } = await import("./useSandboxComposer");

function Wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

const makeDevice = (id: string, overrides: Partial<Device> = {}): Device => ({
  id,
  name: `Aparelho ${id}`,
  identifier: null,
  status: "CONNECTED",
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
});

const deviceA = makeDevice("dev-a");
const deviceB = makeDevice("dev-b");
const deviceC = makeDevice("dev-c");

const row = (n: number): SendMessageResult => ({
  messageId: `msg-${n}`,
  status: "PENDING",
});

const PHONE = "(11) 99999-8888";
const PHONE_DIGITS = "11999998888";

function renderComposer(initialDevices: Device[] = [deviceA, deviceB]) {
  return renderHook(
    ({ devices }: { devices: Device[] }) => useSandboxComposer(devices),
    { wrapper: Wrapper, initialProps: { devices: initialDevices } },
  );
}

type Composer = ReturnType<typeof renderComposer>["result"];

/** Fills a valid text send: phone, text and burst size. */
function fillTextForm(result: Composer, count = 1) {
  act(() => result.current.setField("phone", PHONE));
  act(() => result.current.setField("text", "Olá"));
  act(() => result.current.setField("count", count));
}

function fillGroupForm(result: Composer) {
  act(() => result.current.handleTypeChange("group"));
  act(() => result.current.setField("groupJid", "123-456@g.us"));
  act(() => result.current.setField("text", "Oi grupo"));
}

async function send(result: Composer) {
  await act(async () => {
    await result.current.handleSend();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const notOnWhatsApp = () =>
  new AppError(
    "Número não está no WhatsApp",
    ErrorCodes.NUMBER_NOT_ON_WHATSAPP,
    422,
  );

describe("useSandboxComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("device selection", () => {
    it("defaults to the first connected device", () => {
      const { result } = renderComposer([deviceA, deviceB]);

      expect(result.current.formData.deviceId).toBe("dev-a");
    });

    it("picks the first device once the list lands", () => {
      const { result, rerender } = renderComposer([]);
      expect(result.current.formData.deviceId).toBe("");

      rerender({ devices: [deviceB, deviceA] });

      expect(result.current.formData.deviceId).toBe("dev-b");
    });

    it("keeps a chosen device while it stays connected", () => {
      const { result, rerender } = renderComposer([deviceA, deviceB]);
      act(() => result.current.setField("deviceId", "dev-b"));

      rerender({ devices: [deviceC, deviceB] });

      expect(result.current.formData.deviceId).toBe("dev-b");
    });

    it("re-picks the first device when the chosen one disconnects", () => {
      const { result, rerender } = renderComposer([deviceA, deviceB]);
      act(() => result.current.setField("deviceId", "dev-b"));

      rerender({ devices: [deviceC, deviceA] });

      expect(result.current.formData.deviceId).toBe("dev-c");
    });
  });

  describe("options", () => {
    it("labels devices with their paired number when there is one", () => {
      const paired = makeDevice("dev-p", {
        name: "Comercial",
        identifier: "5511999998888",
      });
      const { result } = renderComposer([paired, makeDevice("dev-u", { name: "Novo" })]);

      expect(result.current.deviceOptions).toEqual([
        { value: "dev-p", label: "Comercial · +55 (11) 99999-8888" },
        { value: "dev-u", label: "Novo" },
      ]);
    });

    it("offers every message type with a translated label", () => {
      const { result } = renderComposer();

      expect(result.current.typeOptions).toEqual([
        { value: "text", label: "Texto" },
        { value: "image", label: "Imagem" },
        { value: "audio", label: "Áudio" },
        { value: "video", label: "Vídeo" },
        { value: "document", label: "Documento" },
        { value: "group", label: "Grupo" },
      ]);
    });

    it("exposes the recent recipients and their remover", () => {
      const { result } = renderComposer();

      expect(result.current.recents).toEqual(["5511999990001"]);
      result.current.removeRecipient("5511999990001");
      expect(removeRecipientMock).toHaveBeenCalledWith("5511999990001");
    });
  });

  describe("handleTypeChange", () => {
    it("keeps device, phone and count and clears the type-specific fields", () => {
      const { result } = renderComposer();
      act(() => result.current.setField("deviceId", "dev-b"));
      fillTextForm(result, 4);
      act(() => result.current.setField("groupJid", "123@g.us"));
      act(() => result.current.setField("mediaUrl", "https://cdn.test/a.png"));
      act(() => result.current.setField("caption", "Legenda"));
      act(() => result.current.setField("fileName", "a.pdf"));

      act(() => result.current.handleTypeChange("image"));

      expect(result.current.formData).toEqual({
        ...INITIAL_SANDBOX_FORM,
        messageType: "image",
        deviceId: "dev-b",
        phone: PHONE,
        count: 4,
      });
    });

    it("clears validation errors from the previous type", () => {
      const { result } = renderComposer();
      act(() => {
        void result.current.handleSend();
      });
      expect(result.current.errors.text).toBe("required");

      act(() => result.current.handleTypeChange("audio"));

      expect(result.current.errors).toEqual({});
    });
  });

  describe("handleSend", () => {
    it("validates first and sends nothing when the form is invalid", async () => {
      const { result } = renderComposer();

      await send(result);

      expect(sendMock).not.toHaveBeenCalled();
      expect(result.current.errors).toMatchObject({
        phone: "invalid",
        text: "required",
      });
      expect(result.current.isSending).toBe(false);
      expect(showSuccessMock).not.toHaveBeenCalled();
    });

    it("sends a single message without a burst suffix", async () => {
      sendMock.mockResolvedValue(row(1));
      const { result } = renderComposer();
      fillTextForm(result, 1);

      await send(result);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith({
        deviceId: "dev-a",
        type: "text",
        input: { phone: PHONE_DIGITS, text: "Olá" },
      });
      expect(result.current.sends).toEqual([row(1)]);
    });

    it("sends a burst one message at a time, numbering each and revealing rows as they land", async () => {
      const first = deferred<SendMessageResult>();
      const second = deferred<SendMessageResult>();
      const third = deferred<SendMessageResult>();
      sendMock
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockReturnValueOnce(third.promise);
      const { result } = renderComposer();
      fillTextForm(result, 3);

      let sending!: Promise<void>;
      act(() => {
        sending = result.current.handleSend();
      });

      expect(result.current.isSending).toBe(true);
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result.current.sends).toEqual([]);

      await act(async () => first.resolve(row(1)));
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(result.current.sends).toEqual([row(1)]);

      await act(async () => second.resolve(row(2)));
      expect(sendMock).toHaveBeenCalledTimes(3);
      expect(result.current.sends).toEqual([row(1), row(2)]);

      await act(async () => {
        third.resolve(row(3));
        await sending;
      });

      expect(result.current.sends).toEqual([row(1), row(2), row(3)]);
      expect(result.current.isSending).toBe(false);
      expect(sendMock.mock.calls.map(([args]) => args)).toEqual(
        [1, 2, 3].map((i) => ({
          deviceId: "dev-a",
          type: "text",
          input: { phone: PHONE_DIGITS, text: `Olá (${i}/3)` },
        })),
      );
    });

    it("replaces the previous queue when a new send starts", async () => {
      sendMock.mockResolvedValueOnce(row(1)).mockResolvedValueOnce(row(2));
      const { result } = renderComposer();
      fillTextForm(result, 1);
      await send(result);
      expect(result.current.sends).toEqual([row(1)]);

      await send(result);

      expect(result.current.sends).toEqual([row(2)]);
    });

    it("stops at the first failure and keeps the rows collected so far", async () => {
      sendMock
        .mockResolvedValueOnce(row(1))
        .mockRejectedValueOnce(
          new AppError("Dispositivo offline", ErrorCodes.DEVICE_OFFLINE, 409),
        )
        .mockResolvedValue(row(3));
      const { result } = renderComposer();
      fillTextForm(result, 3);

      await send(result);

      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(result.current.sends).toEqual([row(1)]);
      expect(result.current.isSending).toBe(false);
      expect(result.current.errors.phone).toBeUndefined();
    });

    it("pins the not-on-WhatsApp error on the phone field", async () => {
      sendMock.mockRejectedValue(notOnWhatsApp());
      const { result } = renderComposer();
      fillTextForm(result, 2);

      await send(result);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result.current.errors.phone).toBe(PHONE_NOT_ON_WHATSAPP);
      expect(result.current.sends).toEqual([]);
      expect(result.current.isSending).toBe(false);
    });

    it.each([
      [
        "an AppError with another code",
        new AppError("Falha", ErrorCodes.DEVICE_OFFLINE, 409),
      ],
      [
        "a non-AppError carrying the same code",
        Object.assign(new Error("Falha"), {
          code: ErrorCodes.NUMBER_NOT_ON_WHATSAPP,
        }),
      ],
    ])("leaves the phone field clean for %s", async (_label, error) => {
      sendMock.mockRejectedValue(error);
      const { result } = renderComposer();
      fillTextForm(result, 1);

      await send(result);

      expect(result.current.errors.phone).toBeUndefined();
    });

    it("never pins the not-on-WhatsApp error on a group send", async () => {
      sendMock.mockRejectedValue(notOnWhatsApp());
      const { result } = renderComposer();
      fillGroupForm(result);

      await send(result);

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(result.current.errors.phone).toBeUndefined();
    });

    it("remembers the recipient and confirms the queued total after a successful send", async () => {
      sendMock
        .mockResolvedValueOnce(row(1))
        .mockResolvedValueOnce(row(2))
        .mockResolvedValueOnce(row(3));
      const { result } = renderComposer();
      fillTextForm(result, 3);

      await send(result);

      expect(addRecipientMock).toHaveBeenCalledTimes(1);
      expect(addRecipientMock).toHaveBeenCalledWith(PHONE);
      expect(showSuccessMock).toHaveBeenCalledTimes(1);
      expect(showSuccessMock).toHaveBeenCalledWith(
        "3 mensagem(ns) na fila de envio.",
      );
    });

    it("remembers the recipient and confirms a partial burst", async () => {
      sendMock
        .mockResolvedValueOnce(row(1))
        .mockRejectedValueOnce(
          new AppError("Dispositivo offline", ErrorCodes.DEVICE_OFFLINE, 409),
        );
      const { result } = renderComposer();
      fillTextForm(result, 5);

      await send(result);

      expect(addRecipientMock).toHaveBeenCalledWith(PHONE);
      expect(showSuccessMock).toHaveBeenCalledWith(
        "1 mensagem(ns) na fila de envio.",
      );
    });

    it("neither remembers the recipient nor confirms when nothing was queued", async () => {
      sendMock.mockRejectedValue(notOnWhatsApp());
      const { result } = renderComposer();
      fillTextForm(result, 3);

      await send(result);

      expect(addRecipientMock).not.toHaveBeenCalled();
      expect(showSuccessMock).not.toHaveBeenCalled();
    });

    it("confirms a group send without remembering any recipient", async () => {
      sendMock.mockResolvedValue(row(1));
      const { result } = renderComposer();
      fillGroupForm(result);

      await send(result);

      expect(sendMock).toHaveBeenCalledWith({
        deviceId: "dev-a",
        type: "group",
        input: { groupJid: "123-456@g.us", text: "Oi grupo" },
      });
      expect(addRecipientMock).not.toHaveBeenCalled();
      expect(showSuccessMock).toHaveBeenCalledWith(
        "1 mensagem(ns) na fila de envio.",
      );
    });
  });

  describe("handleReset", () => {
    it("keeps the device and clears the form and the queue", async () => {
      sendMock.mockResolvedValue(row(1));
      const { result } = renderComposer();
      act(() => result.current.setField("deviceId", "dev-b"));
      fillTextForm(result, 1);
      await send(result);
      act(() => result.current.handleTypeChange("video"));
      act(() => result.current.setField("mediaUrl", "https://cdn.test/a.mp4"));
      expect(result.current.sends).toEqual([row(1)]);

      act(() => result.current.handleReset());

      expect(result.current.formData).toEqual({
        ...INITIAL_SANDBOX_FORM,
        deviceId: "dev-b",
      });
      expect(result.current.sends).toEqual([]);
      expect(result.current.errors).toEqual({});
    });
  });
});
