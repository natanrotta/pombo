import { Request, Response } from "express";
import { MessageController } from "./message.controller";
import { BadRequestError } from "@shared/error";

const mockExecute = vi.fn();

vi.mock("tsyringe", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  container: {
    resolve: vi.fn(() => ({ execute: mockExecute })),
  },
}));

function mockReqRes(overrides: Partial<Request> = {}) {
  const headers: Record<string, string> = {};
  const req = {
    body: {},
    params: {},
    auth: { userId: "u-1", accountId: "acc-1", language: "pt-BR" },
    header: (name: string) => headers[name.toLowerCase()],
    __setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    ...overrides,
  } as unknown as Request & {
    __setHeader: (name: string, value: string) => void;
  };
  const json = vi.fn();
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ json, send });
  const res = { status, json, send } as unknown as Response;
  return { req, res, status, json, send };
}

describe("MessageController", () => {
  let controller: MessageController;

  beforeEach(() => {
    controller = new MessageController();
    vi.clearAllMocks();
  });

  it("send reads the Idempotency-Key header → 202 { ok, data }", async () => {
    mockExecute.mockResolvedValue({ messageId: "m1", status: "PENDING" });
    const { req, res, status, json } = mockReqRes({ params: { id: "d1" } });
    req.__setHeader("Idempotency-Key", "key-1");
    req.body = { phone: "5548", text: "oi" };

    await controller.send(req, res);

    expect(mockExecute).toHaveBeenCalledWith({
      accountId: "acc-1",
      deviceId: "d1",
      phone: "5548",
      text: "oi",
      idempotencyKey: "key-1",
    });
    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      data: { messageId: "m1", status: "PENDING" },
    });
  });

  it("send throws BadRequest when the Idempotency-Key header is missing", async () => {
    const { req, res } = mockReqRes({ params: { id: "d1" } });
    req.body = { phone: "5548", text: "oi" };

    await expect(controller.send(req, res)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("sendToGroup maps groupJid + text → input and returns 202", async () => {
    mockExecute.mockResolvedValue({ messageId: "m1", status: "PENDING" });
    const { req, res, status, json } = mockReqRes({ params: { id: "d1" } });
    req.__setHeader("Idempotency-Key", "key-1");
    req.body = { groupJid: "120363000000000001@g.us", text: "oi" };

    await controller.sendToGroup(req, res);

    expect(mockExecute).toHaveBeenCalledWith({
      accountId: "acc-1",
      deviceId: "d1",
      groupJid: "120363000000000001@g.us",
      text: "oi",
      idempotencyKey: "key-1",
    });
    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      data: { messageId: "m1", status: "PENDING" },
    });
  });

  it("sendToGroup throws BadRequest when the Idempotency-Key header is missing", async () => {
    const { req, res } = mockReqRes({ params: { id: "d1" } });
    req.body = { groupJid: "120363000000000001@g.us", text: "oi" };

    await expect(controller.sendToGroup(req, res)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("sendImage maps body→input (payload = body minus phone) with the image type → 202", async () => {
    mockExecute.mockResolvedValue({ messageId: "m1", status: "PENDING" });
    const { req, res, status, json } = mockReqRes({ params: { id: "d1" } });
    req.__setHeader("Idempotency-Key", "key-1");
    req.body = { phone: "5548", image: "https://ex.com/a.png", caption: "hi" };

    await controller.sendImage(req, res);

    expect(mockExecute).toHaveBeenCalledWith({
      accountId: "acc-1",
      deviceId: "d1",
      phone: "5548",
      idempotencyKey: "key-1",
      type: "image",
      payload: { image: "https://ex.com/a.png", caption: "hi" },
    });
    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      data: { messageId: "m1", status: "PENDING" },
    });
  });

  it.each([
    ["audio", { audio: "https://ex.com/a.ogg" }],
    ["video", { video: "https://ex.com/a.mp4" }],
    ["document", { document: "https://ex.com/a.pdf", fileName: "a.pdf" }],
  ] as const)(
    "send%s maps body→input with the matching type → 202",
    async (label, body) => {
      mockExecute.mockResolvedValue({ messageId: "m1", status: "PENDING" });
      const { req, res, status } = mockReqRes({ params: { id: "d1" } });
      req.__setHeader("Idempotency-Key", "key-1");
      req.body = { phone: "5548", ...body };
      const handlers = {
        audio: controller.sendAudio,
        video: controller.sendVideo,
        document: controller.sendDocument,
      };

      await handlers[label](req, res);

      expect(mockExecute).toHaveBeenCalledWith({
        accountId: "acc-1",
        deviceId: "d1",
        phone: "5548",
        idempotencyKey: "key-1",
        type: label,
        payload: body,
      });
      expect(status).toHaveBeenCalledWith(202);
    },
  );

  it("sendImage throws BadRequest when the Idempotency-Key header is missing", async () => {
    const { req, res } = mockReqRes({ params: { id: "d1" } });
    req.body = { phone: "5548", image: "https://ex.com/a.png" };

    await expect(controller.sendImage(req, res)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("getStatus passes the id → 200", async () => {
    mockExecute.mockResolvedValue({ messageId: "m1", status: "READ" });
    const { req, res, status } = mockReqRes({ params: { id: "m1" } });

    await controller.getStatus(req, res);

    expect(mockExecute).toHaveBeenCalledWith("acc-1", "m1");
    expect(status).toHaveBeenCalledWith(200);
  });
});
