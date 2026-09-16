import { memo } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/shared/components/ui/StatusBadge";
import type { DeviceStatus } from "@/modules/devices/domain/entities/Device";

// The design paints three device states: online (green), offline (red) and
// pairing (blue — the handoff's amber is out, R11 forbids warm hues).
const STATUS_TONE: Record<
  DeviceStatus,
  "success" | "warning" | "error" | "info" | "neutral"
> = {
  CONNECTED: "success",
  CONNECTING: "info",
  QR_PENDING: "info",
  DISCONNECTED: "error",
  LOGGED_OUT: "error",
};

/** Pairing and connecting are transient: the dot blinks while they last. */
const PENDING_STATUSES = new Set<DeviceStatus>(["CONNECTING", "QR_PENDING"]);

interface DeviceStatusBadgeProps {
  status: DeviceStatus;
}

export const DeviceStatusBadge = memo(function DeviceStatusBadge({
  status,
}: DeviceStatusBadgeProps) {
  const { t } = useTranslation("devices");
  return (
    <StatusBadge
      status={STATUS_TONE[status]}
      isPending={PENDING_STATUSES.has(status)}
      label={t(`status.${status}`)}
    />
  );
});
