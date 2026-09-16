import { memo, useCallback } from "react";
import { Box, chakra, Flex, Text } from "@chakra-ui/react";
import { DeviceStatusBadge } from "@/modules/devices/presentation/components/DeviceStatusBadge";
import { useDeviceSummary } from "@/modules/devices/presentation/hooks/useDeviceSummary";
import type { Device } from "@/modules/devices/domain/entities/Device";

interface DeviceRowProps {
  device: Device;
  onOpen: (id: string) => void;
  /** Hover/focus: pre-warm the detail page. */
  onHover: (id: string) => void;
}

/** One line of the device list view: name + metadata, status, hover action. */
export const DeviceRow = memo(function DeviceRow({
  device,
  onOpen,
  onHover,
}: DeviceRowProps) {
  const { subtitle, meta, hoverAction } = useDeviceSummary(device);

  const handleOpen = useCallback(() => onOpen(device.id), [onOpen, device.id]);
  const handleHover = useCallback(
    () => onHover(device.id),
    [onHover, device.id],
  );

  return (
    <chakra.button
      type="button"
      className="group"
      data-cy="device-row"
      onClick={handleOpen}
      onMouseEnter={handleHover}
      onFocus={handleHover}
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr) auto", md: "minmax(0, 1fr) 132px 120px" }}
      alignItems="center"
      gap={3.5}
      w="100%"
      textAlign="left"
      px={4.5}
      py={3.5}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      cursor="pointer"
      transition="background-color 150ms ease"
      _hover={{ bg: "bg.hover" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "border.focus", outlineOffset: "-2px" }}
      _last={{ borderBottomWidth: 0 }}
    >
      <Flex direction="column" gap={1} minW={0}>
        <Text fontWeight="500" fontSize="15px" lineClamp={1}>
          {device.name}
        </Text>
        <Text textStyle="mono" color="text.muted" lineClamp={1}>
          {subtitle} · {meta}
        </Text>
      </Flex>

      <Box justifySelf="start">
        <DeviceStatusBadge status={device.status} />
      </Box>

      <Text
        display={{ base: "none", md: "block" }}
        justifySelf="end"
        textStyle="mono"
        fontWeight="500"
        color="text.brand"
        whiteSpace="nowrap"
        opacity={0}
        _groupHover={{ opacity: 1 }}
        _groupFocusVisible={{ opacity: 1 }}
        transition="opacity 150ms ease"
      >
        {hoverAction} →
      </Text>
    </chakra.button>
  );
});
