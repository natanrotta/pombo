import type { AuthRepository } from "@/modules/auth/domain/repositories/AuthRepository";
import type { DeviceRepository } from "@/modules/devices/domain/repositories/DeviceRepository";
import type { AccountRepository } from "@/modules/account/domain/repositories/AccountRepository";
import type { MessagingRepository } from "@/modules/messaging/domain/repositories/MessagingRepository";

import { HttpAuthRepository } from "@/modules/auth/infrastructure/repositories/HttpAuthRepository";
import { HttpDeviceRepository } from "@/modules/devices/infrastructure/repositories/HttpDeviceRepository";
import { HttpAccountRepository } from "@/modules/account/infrastructure/repositories/HttpAccountRepository";
import { HttpMessagingRepository } from "@/modules/messaging/infrastructure/repositories/HttpMessagingRepository";

export const repositories = {
  auth: new HttpAuthRepository() as AuthRepository,
  devices: new HttpDeviceRepository() as DeviceRepository,
  account: new HttpAccountRepository() as AccountRepository,
  messaging: new HttpMessagingRepository() as MessagingRepository,
} as const;
