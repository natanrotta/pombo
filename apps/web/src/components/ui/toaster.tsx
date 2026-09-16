import {
  Toaster as ChakraToaster,
  Flex,
  Icon,
  Portal,
  Text,
  Toast,
  createToaster,
} from "@chakra-ui/react";
import {
  FiAlertTriangle,
  FiCheck,
  FiInfo,
  FiXCircle,
} from "@/shared/components/icons";

export const toaster = createToaster({
  placement: "bottom",
  pauseOnPageIdle: true,
});

/**
 * One `status.*` token family per toast type — the same palette the badges
 * use, so a toast follows the color mode like every other surface (it portals
 * outside the page tree but still sits under the `<html>` class next-themes
 * toggles).
 */
const STATUS_CONFIG = {
  success: {
    icon: FiCheck,
    tint: "status.success.bg",
    border: "status.success.border",
    iconBg: "status.success.solid",
    fg: "status.success.fg",
  },
  info: {
    icon: FiInfo,
    tint: "status.info.bg",
    border: "status.info.border",
    iconBg: "status.info.solid",
    fg: "status.info.fg",
  },
  warning: {
    icon: FiAlertTriangle,
    tint: "status.warning.bg",
    border: "status.warning.border",
    iconBg: "status.warning.solid",
    fg: "status.warning.fg",
  },
  error: {
    icon: FiXCircle,
    tint: "status.error.bg",
    border: "status.error.border",
    iconBg: "status.error.solid",
    fg: "status.error.fg",
  },
} as const;

export type ToastStatus = keyof typeof STATUS_CONFIG;

function resolveStatus(type: string | undefined): ToastStatus {
  return type && type in STATUS_CONFIG ? (type as ToastStatus) : "info";
}

export function Toaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => {
          const config = STATUS_CONFIG[resolveStatus(toast.type)];
          return (
            // `Toast.Root` owns the enter/exit animation and the dismiss timer;
            // everything inside is the app's own chrome (v2 rendered this via
            // the `render` option, which v3 moved up to the Toaster).
            <Toast.Root
              data-cy="toast"
              display="flex"
              alignItems="center"
              gap={3}
              px={4}
              py={3}
              // Opaque surface + the status tint layered on top: in dark mode
              // `status.*.bg` is a translucent wash, and a floating toast must
              // never let the page show through. A one-color gradient is the
              // CSS way to paint a color as a layer over `background-color`.
              bg="bg.elevated"
              backgroundImage={`linear-gradient({colors.${config.tint}}, {colors.${config.tint}})`}
              borderRadius="xl"
              boxShadow="shadow.panel"
              borderWidth="1px"
              borderColor={config.border}
              mx="auto"
              w="fit-content"
              maxW="420px"
            >
              <Flex
                align="center"
                justify="center"
                w={7}
                h={7}
                borderRadius="full"
                bg={config.iconBg}
                flexShrink={0}
              >
                <Icon boxSize={4} color="white">
                  <config.icon />
                </Icon>
              </Flex>
              <Flex direction="column" gap={0.5}>
                {toast.title && (
                  <Toast.Title
                    fontSize="sm"
                    fontWeight="600"
                    color={config.fg}
                    lineHeight="short"
                  >
                    {toast.title}
                  </Toast.Title>
                )}
                {toast.description && (
                  <Text
                    fontSize="xs"
                    color={config.fg}
                    opacity={0.8}
                    lineHeight="short"
                  >
                    {toast.description}
                  </Text>
                )}
              </Flex>
            </Toast.Root>
          );
        }}
      </ChakraToaster>
    </Portal>
  );
}
