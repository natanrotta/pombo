/**
 * Lifecycle of a WhatsApp device socket. Declared once in the shared wire
 * contract (`@pombo/shared-types`) and mirrored by the Prisma `device_status`
 * enum — `device-status.spec.ts` (next to this file) pins the two. A device is only
 * "live" when CONNECTED; every other status is reported (as an informational
 * connected-count) by `GET /api/health` without making the process unhealthy.
 */
export type { DeviceStatus } from "@pombo/shared-types";
