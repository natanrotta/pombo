import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FiClock, FiLogOut, FiTrash2 } from "@/shared/components/icons";
import type { ActionMenuItem } from "@/shared/components/ui/ActionMenu";
import { EntityCard } from "@/shared/components/ui/EntityCard";
import { DeviceStatusBadge } from "@/modules/devices/presentation/components/DeviceStatusBadge";
import { useDeviceSummary } from "@/modules/devices/presentation/hooks/useDeviceSummary";
import type { Device } from "@/modules/devices/domain/entities/Device";

interface DeviceCardProps {
  device: Device;
  onOpen: (id: string) => void;
  /** Hover/focus: pre-warm the detail page. */
  onHover: (id: string) => void;
  onDelete: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export const DeviceCard = memo(function DeviceCard({
  device,
  onOpen,
  onHover,
  onDelete,
  onDisconnect,
}: DeviceCardProps) {
  const { t } = useTranslation("devices");

  const handleOpen = useCallback(() => onOpen(device.id), [onOpen, device.id]);
  const handleHover = useCallback(
    () => onHover(device.id),
    [onHover, device.id],
  );
  const handleDelete = useCallback(
    () => onDelete(device.id),
    [onDelete, device.id],
  );
  const handleDisconnect = useCallback(
    () => onDisconnect(device.id),
    [onDisconnect, device.id],
  );

  const { subtitle, meta, hoverAction, isLive } = useDeviceSummary(device);

  const actionItems: ActionMenuItem[] = [
    ...(device.status === "CONNECTED"
      ? [
          {
            label: t("list.disconnect"),
            icon: FiLogOut,
            onClick: handleDisconnect,
          },
        ]
      : []),
    {
      label: t("list.delete"),
      icon: FiTrash2,
      isDanger: true,
      onClick: handleDelete,
    },
  ];

  return (
    <EntityCard
      title={device.name}
      subtitle={subtitle}
      badges={[<DeviceStatusBadge key="status" status={device.status} />]}
      metaItems={[{ icon: FiClock, label: meta }]}
      hoverAction={hoverAction}
      isLive={isLive}
      onClick={handleOpen}
      onHover={handleHover}
      actionItems={actionItems}
    />
  );
});
