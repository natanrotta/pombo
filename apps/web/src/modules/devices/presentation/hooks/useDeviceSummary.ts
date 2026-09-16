import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatShortDate } from "@/shared/utils/date";
import { formatPhoneDisplay } from "@/shared/utils/phone";
import type { Device } from "@/modules/devices/domain/entities/Device";

interface DeviceSummary {
  /** The paired number, or "not paired yet". */
  subtitle: string;
  /** The one piece of metadata the card/row footer shows. */
  meta: string;
  /** What clicking the device does, from its current state. */
  hoverAction: string;
  /** A connected device is live: it breathes and rests on a green edge. */
  isLive: boolean;
}

/**
 * The same device, described the same way in the card and in the row — what
 * the two list views share besides the status badge.
 */
export function useDeviceSummary(device: Device): DeviceSummary {
  const { t } = useTranslation("devices");

  return useMemo(() => {
    const isPairing =
      device.status === "QR_PENDING" || device.status === "CONNECTING";
    const lastConnected = device.lastConnectedAt
      ? formatShortDate(device.lastConnectedAt)
      : null;

    const meta = isPairing
      ? t("list.meta.created", { date: formatShortDate(device.createdAt) })
      : device.status === "CONNECTED"
        ? t("list.meta.since", { date: lastConnected ?? "—" })
        : lastConnected
          ? t("list.meta.left", { date: lastConnected })
          : t("list.neverConnected");

    return {
      subtitle: device.identifier
        ? formatPhoneDisplay(device.identifier)
        : t("list.notPaired"),
      meta,
      hoverAction: isPairing
        ? t("list.action.qr")
        : device.status === "CONNECTED"
          ? t("list.action.open")
          : t("list.action.reconnect"),
      isLive: device.status === "CONNECTED",
    };
  }, [device, t]);
}
