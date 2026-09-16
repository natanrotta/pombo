import { memo } from "react";
import { Badge, Box, type BadgeProps } from "@chakra-ui/react";

type StatusType = "success" | "warning" | "error" | "info" | "neutral";

// Colors are resolved via semantic status tokens so badges automatically adapt
// to light/dark themes. Warning maps to purple on purpose — the project
// explicitly avoids yellow/orange tones.
const statusStyles: Record<
  StatusType,
  Pick<BadgeProps, "bg" | "color" | "borderColor" | "borderWidth">
> = {
  success: {
    bg: "status.success.bg",
    color: "status.success.fg",
    borderColor: "status.success.border",
    borderWidth: "1px",
  },
  warning: {
    bg: "status.warning.bg",
    color: "status.warning.fg",
    borderColor: "status.warning.border",
    borderWidth: "1px",
  },
  error: {
    bg: "status.error.bg",
    color: "status.error.fg",
    borderColor: "status.error.border",
    borderWidth: "1px",
  },
  info: {
    bg: "status.info.bg",
    color: "status.info.fg",
    borderColor: "status.info.border",
    borderWidth: "1px",
  },
  neutral: {
    bg: "status.neutral.bg",
    color: "status.neutral.fg",
    borderColor: "status.neutral.border",
    borderWidth: "1px",
  },
};

interface StatusBadgeProps extends Omit<BadgeProps, "colorScheme"> {
  status: StatusType;
  label: string;
  /** A live state blinks its dot (pairing, sending). */
  isPending?: boolean;
}

function StatusBadgeComponent({
  status,
  label,
  isPending = false,
  ...props
}: StatusBadgeProps) {
  const style = statusStyles[status];
  return (
    <Badge {...style} display="inline-flex" alignItems="center" gap={2} {...props}>
      <Box
        as="span"
        w="5px"
        h="5px"
        borderRadius="full"
        bg="currentColor"
        flexShrink={0}
        // Only a connected device carries the halo — the design reserves any
        // glow for a live state.
        boxShadow={status === "success" ? "0 0 8px currentColor" : undefined}
        animation={isPending ? "statusBlink 1.8s ease-in-out infinite" : undefined}
      />
      {label}
    </Badge>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);
