import { Router } from "express";
import { container } from "tsyringe";
import { MessageController } from "../controller/message.controller";
import {
  validateRequest,
  asyncHandler,
  authMiddleware,
} from "@core/http/middlewares";
import {
  SendMessageDTOSchema,
  SendGroupMessageDTOSchema,
  SendImageDTOSchema,
  SendAudioDTOSchema,
  SendVideoDTOSchema,
  SendDocumentDTOSchema,
  SendMessageParamSchema,
  MessageIdParamSchema,
} from "@modules/messaging/application/dto/message.dto";

const messageRoutes = Router();
const messageController = container.resolve(MessageController);

// Every messaging route requires an authenticated session (JWT).
messageRoutes.use(authMiddleware());

// The Idempotency-Key header is validated in the controller (validateRequest
// covers params/query/body only). 202 = accepted + socket alive, NOT delivered.
messageRoutes.post(
  "/devices/:id/messages",
  validateRequest({
    params: SendMessageParamSchema,
    body: SendMessageDTOSchema,
  }),
  asyncHandler(messageController.send.bind(messageController)),
);

// Group text send — same params + Idempotency-Key contract as the text send
// above, but the recipient is a group JID (`<id>@g.us`) instead of a phone.
messageRoutes.post(
  "/devices/:id/messages/group",
  validateRequest({
    params: SendMessageParamSchema,
    body: SendGroupMessageDTOSchema,
  }),
  asyncHandler(messageController.sendToGroup.bind(messageController)),
);

// Rich sends — one route per type, each with its own body schema. Same params +
// Idempotency-Key contract as the text send above.
messageRoutes.post(
  "/devices/:id/messages/image",
  validateRequest({ params: SendMessageParamSchema, body: SendImageDTOSchema }),
  asyncHandler(messageController.sendImage),
);
messageRoutes.post(
  "/devices/:id/messages/audio",
  validateRequest({ params: SendMessageParamSchema, body: SendAudioDTOSchema }),
  asyncHandler(messageController.sendAudio),
);
messageRoutes.post(
  "/devices/:id/messages/video",
  validateRequest({ params: SendMessageParamSchema, body: SendVideoDTOSchema }),
  asyncHandler(messageController.sendVideo),
);
messageRoutes.post(
  "/devices/:id/messages/document",
  validateRequest({
    params: SendMessageParamSchema,
    body: SendDocumentDTOSchema,
  }),
  asyncHandler(messageController.sendDocument),
);

messageRoutes.get(
  "/messages/:id",
  validateRequest({ params: MessageIdParamSchema }),
  asyncHandler(messageController.getStatus.bind(messageController)),
);

export { messageRoutes };
