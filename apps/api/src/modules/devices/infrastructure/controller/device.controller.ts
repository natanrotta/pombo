import { Request, Response } from "express";
import { container } from "tsyringe";
import {
  RegisterDeviceUseCase,
  ListDevicesUseCase,
  GetDeviceUseCase,
  GetDeviceQrUseCase,
  ListDeviceGroupsUseCase,
  UpdateDeviceWebhooksUseCase,
  ConnectDeviceUseCase,
  DisconnectDeviceUseCase,
  DeleteDeviceUseCase,
} from "@modules/devices/application/use-case/devices";

/**
 * WhatsApp device management (single-operator admin surface). Every route sits
 * behind the JWT auth middleware — see `device.routes.ts`. All responses use the
 * `{ ok, data }` envelope.
 */
export class DeviceController {
  async register(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(RegisterDeviceUseCase);
    const result = await useCase.execute(req.auth.accountId, req.body);
    return res.status(201).json({ ok: true, data: result });
  }

  async list(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(ListDevicesUseCase);
    const result = await useCase.execute(req.auth.accountId);
    return res.status(200).json({ ok: true, data: result });
  }

  async getById(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(GetDeviceUseCase);
    const result = await useCase.execute(req.auth.accountId, id);
    return res.status(200).json({ ok: true, data: result });
  }

  async getQr(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(GetDeviceQrUseCase);
    const result = await useCase.execute(req.auth.accountId, id);
    return res.status(200).json({ ok: true, data: result });
  }

  async listGroups(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(ListDeviceGroupsUseCase);
    const result = await useCase.execute(req.auth.accountId, id);
    return res.status(200).json({ ok: true, data: result });
  }

  async updateWebhooks(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(UpdateDeviceWebhooksUseCase);
    const result = await useCase.execute(req.auth.accountId, id, req.body);
    return res.status(200).json({ ok: true, data: result });
  }

  async connect(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(ConnectDeviceUseCase);
    const result = await useCase.execute(req.auth.accountId, id);
    return res.status(202).json({ ok: true, data: result });
  }

  async disconnect(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(DisconnectDeviceUseCase);
    const result = await useCase.execute(req.auth.accountId, id);
    return res.status(200).json({ ok: true, data: result });
  }

  async remove(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(DeleteDeviceUseCase);
    await useCase.execute(req.auth.accountId, id);
    return res.status(204).send();
  }
}
