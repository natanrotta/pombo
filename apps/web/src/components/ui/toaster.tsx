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
 * Fixed light palette, on purpose: the toast floats over the app as its own
 * surface and reads the same in light and dark mode. These are the only raw hex
 * values sanctioned outside the theme — every other surface uses semantic tokens.
 */
const STATUS_CONFIG = {
  success: {
    icon: FiCheck,
    bg: "#ecfdf5",
    border: "#a7f3d0",
    iconBg: "#10b981",
    text: "#065f46",
  },
  info: {
    icon: FiInfo,
    bg: "#eff6ff",
    border: "#bfdbfe",
    iconBg: "#3b82f6",
    text: "#1e40af",
  },
  warning: {
    icon: FiAlertTriangle,
    bg: "#faf5ff",
    border: "#e9d8fd",
    iconBg: "#805ad5",
    text: "#553c9a",
  },
  error: {
    icon: FiXCircle,
    bg: "#fef2f2",
    border: "#fecaca",
    iconBg: "#ef4444",
    text: "#991b1b",
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
              display="flex"
              alignItems="center"
              gap={3}
              px={4}
              py={3}
              bg={config.bg}
              borderRadius="xl"
              boxShadow="0 4px 20px rgba(0,0,0,0.08)"
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
                    color={config.text}
                    lineHeight="short"
                  >
                    {toast.title}
                  </Toast.Title>
                )}
                {toast.description && (
                  <Text
                    fontSize="xs"
                    color={config.text}
                    opacity={0.75}
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
