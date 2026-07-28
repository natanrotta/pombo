import { Request, Response } from "express";
import { container } from "tsyringe";
import {
  SendTextMessageUseCase,
  SendRichMessageUseCase,
  GetMessageStatusUseCase,
} from "@modules/messaging/application/use-case/messages";
import { type RichMessageType } from "@modules/messaging/domain/value-object/message-type";
import { BadRequestError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * Messaging endpoints (send text / image / audio / video / document, and poll a
 * message's status). All sit behind the JWT auth middleware — see
 * `message.routes.ts`. `202` = accepted + socket alive, NOT delivered.
 */
export class MessageController {
  async send(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const idempotencyKey = this.requireIdempotencyKey(req);

    const useCase = container.resolve(SendTextMessageUseCase);
    const result = await useCase.execute({
      accountId: req.auth.accountId,
      deviceId: id,
      phone: req.body.phone,
      text: req.body.text,
      idempotencyKey,
    });
    return res.status(202).json({ ok: true, data: result });
  }

  /** Send a text message to a WhatsApp group. Reuses the text send pipeline —
   *  the body's `groupJid` is a canonical `<id>@g.us`, so the use case skips the
   *  user-only JID resolution. */
  async sendToGroup(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const idempotencyKey = this.requireIdempotencyKey(req);

    const useCase = container.resolve(SendTextMessageUseCase);
    const result = await useCase.execute({
      accountId: req.auth.accountId,
      deviceId: id,
      groupJid: req.body.groupJid,
      text: req.body.text,
      idempotencyKey,
    });
    return res.status(202).json({ ok: true, data: result });
  }

  sendImage = (req: Request, res: Response): Promise<Response> =>
    this.sendRich(req, res, "image");
  sendAudio = (req: Request, res: Response): Promise<Response> =>
    this.sendRich(req, res, "audio");
  sendVideo = (req: Request, res: Response): Promise<Response> =>
    this.sendRich(req, res, "video");
  sendDocument = (req: Request, res: Response): Promise<Response> =>
    this.sendRich(req, res, "document");

  /** Shared rich-send path — the body was validated by the route's per-type Zod
   *  schema, so `phone` + the type-specific payload are already well-formed. */
  private async sendRich(
    req: Request,
    res: Response,
    type: RichMessageType,
  ): Promise<Response> {
    const { id } = req.params as { id: string };
    const idempotencyKey = this.requireIdempotencyKey(req);
    const { phone, ...payload } = req.body as {
      phone: string;
      [key: string]: unknown;
    };

    const useCase = container.resolve(SendRichMessageUseCase);
    const result = await useCase.execute({
      accountId: req.auth.accountId,
      deviceId: id,
      phone,
      idempotencyKey,
      type,
      payload,
    });
    return res.status(202).json({ ok: true, data: result });
  }

  private requireIdempotencyKey(req: Request): string {
    const idempotencyKey = req.header("idempotency-key");
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestError(
        "The Idempotency-Key header is required",
        undefined,
        ErrorCodes.BAD_REQUEST,
      );
    }
    return idempotencyKey;
  }

  async getStatus(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as { id: string };
    const useCase = container.resolve(GetMessageStatusUseCase);
    const result = await useCase.execute(req.auth.accountId, id);
    return res.status(200).json({ ok: true, data: result });
  }
}
