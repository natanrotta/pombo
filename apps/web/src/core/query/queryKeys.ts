export const queryKeys = {
  settings: {
    all: ["settings"] as const,
  },
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },
  devices: {
    all: ["devices"] as const,
    list: () => [...queryKeys.devices.all, "list"] as const,
    detail: (id: string) => [...queryKeys.devices.all, "detail", id] as const,
    qr: (id: string) => [...queryKeys.devices.all, "qr", id] as const,
    groups: (id: string) => [...queryKeys.devices.all, "groups", id] as const,
  },
  account: {
    all: ["account"] as const,
    apiToken: () => [...queryKeys.account.all, "api-token"] as const,
  },
  messaging: {
    all: ["messaging"] as const,
    messageStatus: (id: string) =>
      [...queryKeys.messaging.all, "message-status", id] as const,
  },
  health: {
    all: ["health"] as const,
    version: () => [...queryKeys.health.all, "version"] as const,
  },
} as const;
