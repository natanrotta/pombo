import { Request, Response } from "express";
import { DeviceController } from "./device.controller";

const mockExecute = vi.fn();

vi.mock("tsyringe", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  container: {
    resolve: vi.fn(() => ({ execute: mockExecute })),
  },
}));

function mockReqRes(overrides: Partial<Request> = {}) {
  const req = {
    body: {},
    params: {},
    headers: {},
    auth: { userId: "u-1", accountId: "acc-1", language: "pt-BR" },
    ...overrides,
  } as unknown as Request;
  const json = vi.fn();
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ json, send });
  const res = { status, json, send } as unknown as Response;
  return { req, res, status, json, send };
}

describe("DeviceController", () => {
  let controller: DeviceController;

  beforeEach(() => {
    controller = new DeviceController();
    vi.clearAllMocks();
  });

  it("register → 201 { ok, data }", async () => {
    mockExecute.mockResolvedValue({ id: "d1", webhookSecret: "s" });
    const { req, res, status, json } = mockReqRes({ body: { name: "phone" } });

    await controller.register(req, res);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      data: { id: "d1", webhookSecret: "s" },
    });
  });

  it("list → 200 { ok, data }", async () => {
    mockExecute.mockResolvedValue([{ id: "d1" }]);
    const { req, res, status, json } = mockReqRes();

    await controller.list(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true, data: [{ id: "d1" }] });
  });

  it("getById passes the id and returns 200", async () => {
    mockExecute.mockResolvedValue({ id: "d1" });
    const { req, res, status } = mockReqRes({ params: { id: "d1" } });

    await controller.getById(req, res);

    expect(mockExecute).toHaveBeenCalledWith("acc-1", "d1");
    expect(status).toHaveBeenCalledWith(200);
  });

  it("getQr passes account + id and returns 200 { ok, data }", async () => {
    mockExecute.mockResolvedValue({ status: "QR_PENDING", qr: "qr-str" });
    const { req, res, status, json } = mockReqRes({ params: { id: "d1" } });

    await controller.getQr(req, res);

    expect(mockExecute).toHaveBeenCalledWith("acc-1", "d1");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      data: { status: "QR_PENDING", qr: "qr-str" },
    });
  });

  it("listGroups passes account + id and returns 200 { ok, data }", async () => {
    const groups = [{ jid: "120363000000000001@g.us", name: "Team" }];
    mockExecute.mockResolvedValue(groups);
    const { req, res, status, json } = mockReqRes({ params: { id: "d1" } });

    await controller.listGroups(req, res);

    expect(mockExecute).toHaveBeenCalledWith("acc-1", "d1");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ ok: true, data: groups });
  });

  it("updateWebhooks passes account + id + body and returns 200", async () => {
    mockExecute.mockResolvedValue({ id: "d1", webhooks: {} });
    const { req, res, status } = mockReqRes({
      params: { id: "d1" },
      body: { onConnect: "https://hook" },
    });

    await controller.updateWebhooks(req, res);

    expect(mockExecute).toHaveBeenCalledWith("acc-1", "d1", {
      onConnect: "https://hook",
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it("connect → 202 { ok, data }", async () => {
    mockExecute.mockResolvedValue({ id: "d1", status: "CONNECTING" });
    const { req, res, status, json } = mockReqRes({ params: { id: "d1" } });

    await controller.connect(req, res);

    expect(status).toHaveBeenCalledWith(202);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      data: { id: "d1", status: "CONNECTING" },
    });
  });

  it("remove → 204 no body", async () => {
    mockExecute.mockResolvedValue(undefined);
    const { req, res, status, send } = mockReqRes({ params: { id: "d1" } });

    await controller.remove(req, res);

    expect(mockExecute).toHaveBeenCalledWith("acc-1", "d1");
    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalled();
  });
});
