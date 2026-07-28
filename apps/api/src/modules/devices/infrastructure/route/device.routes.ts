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
  DeviceIdParamSchema,
  UpdateDeviceWebhooksDTOSchema,
} from "@modules/devices/application/dto/device.dto";

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
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(deviceController.getById.bind(deviceController)),
);

deviceRoutes.get(
  "/:id/qr",
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(deviceController.getQr.bind(deviceController)),
);

deviceRoutes.get(
  "/:id/groups",
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(deviceController.listGroups.bind(deviceController)),
);

deviceRoutes.patch(
  "/:id/webhooks",
  validateRequest({
    params: DeviceIdParamSchema,
    body: UpdateDeviceWebhooksDTOSchema,
  }),
  asyncHandler(deviceController.updateWebhooks.bind(deviceController)),
);

deviceRoutes.post(
  "/:id/connect",
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(deviceController.connect.bind(deviceController)),
);

deviceRoutes.post(
  "/:id/disconnect",
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(deviceController.disconnect.bind(deviceController)),
);

deviceRoutes.delete(
  "/:id",
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(deviceController.remove.bind(deviceController)),
);

export { deviceRoutes };
