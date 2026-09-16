import { Router } from "express";
import { container } from "tsyringe";
import { DeviceController } from "../controller/device.controller";
import {
  validateRequest,
  asyncHandler,
  authMiddleware,
} from "@core/http/middlewares";
import {
  RegisterDeviceDTOSchema,
  UpdateDeviceWebhooksDTOSchema,
} from "@modules/devices/application/dto/device.dto";
import { UuidParamSchema } from "@shared/dto/common.dto";

const deviceRoutes = Router();
const deviceController = container.resolve(DeviceController);

// Every device-management route requires an authenticated session (JWT).
deviceRoutes.use(authMiddleware());

deviceRoutes.post(
  "/",
  validateRequest({ body: RegisterDeviceDTOSchema }),
  asyncHandler(deviceController.register.bind(deviceController)),
);

deviceRoutes.get(
  "/",
  asyncHandler(deviceController.list.bind(deviceController)),
);

deviceRoutes.get(
  "/:id",
  validateRequest({ params: UuidParamSchema }),
  asyncHandler(deviceController.getById.bind(deviceController)),
);

deviceRoutes.get(
  "/:id/qr",
  validateRequest({ params: UuidParamSchema }),
  asyncHandler(deviceController.getQr.bind(deviceController)),
);

deviceRoutes.get(
  "/:id/groups",
  validateRequest({ params: UuidParamSchema }),
  asyncHandler(deviceController.listGroups.bind(deviceController)),
);

deviceRoutes.patch(
  "/:id/webhooks",
  validateRequest({
    params: UuidParamSchema,
    body: UpdateDeviceWebhooksDTOSchema,
  }),
  asyncHandler(deviceController.updateWebhooks.bind(deviceController)),
);

deviceRoutes.post(
  "/:id/connect",
  validateRequest({ params: UuidParamSchema }),
  asyncHandler(deviceController.connect.bind(deviceController)),
);

deviceRoutes.post(
  "/:id/disconnect",
  validateRequest({ params: UuidParamSchema }),
  asyncHandler(deviceController.disconnect.bind(deviceController)),
);

deviceRoutes.delete(
  "/:id",
  validateRequest({ params: UuidParamSchema }),
  asyncHandler(deviceController.remove.bind(deviceController)),
);

export { deviceRoutes };
