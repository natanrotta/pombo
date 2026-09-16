import { memo } from "react";
import {
  Button,
  chakra,
  Separator,
  Flex,
  Heading,
  Icon,
  Text,
  type FlexProps,
  type StackProps,
  type TextProps,
} from "@chakra-ui/react";
import {
  AnimatePresence,
  motion,
  type MotionProps,
  type Transition,
} from "framer-motion";
import type { ComponentType, PropsWithChildren, ReactNode } from "react";
import { FiPlus } from "@/shared/components/icons";
import type { IconType } from "@/shared/components/icons";
import {
  TRANSITION_DEFAULT,
  TRANSITION_FAST,
} from "@/shared/constants/animation";

// framer-motion 12's motion factory and Chakra v3's polymorphic props collide on
// `transition` (a Chakra token union vs a framer object) and on the drag
// handlers. Re-typing the wrapper as the Chakra props plus only the framer
// animation props we actually use sidesteps both clashes without `any`.
type MotionOf<P> = PropsWithChildren<
  Omit<P, keyof MotionProps> &
    Pick<MotionProps, "initial" | "animate" | "exit" | "transition">
>;

const MotionFlex = motion.create(Flex) as unknown as ComponentType<
  MotionOf<FlexProps>
>;
const MotionText = motion.create(Text) as unknown as ComponentType<
  MotionOf<TextProps>
>;

interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon?: IconType;
}

interface PageHeaderProps extends Omit<StackProps, keyof MotionProps> {
  title: string;
  description?: string;
  count?: number;
  countLabel?: string;
  primaryAction?: PageHeaderAction;
  actions?: ReactNode;
}

function PageHeaderComponent({
  title,
  description,
  count,
  countLabel,
  primaryAction,
  actions,
  children,
  ...stackProps
}: PropsWithChildren<PageHeaderProps>) {
  const hasActions = primaryAction || actions;

  return (
    <MotionFlex
      direction="column"
      gap={0}
      mb={5}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_DEFAULT as Transition}
      {...stackProps}
    >
      <Flex
        justify="space-between"
        align={{ base: "flex-start", md: "center" }}
        direction={{ base: "column", md: "row" }}
        gap={{ base: 3, md: 4 }}
        pb={4}
      >
        <Flex direction="column" gap={0.5} minW={0}>
          <Flex align="baseline" gap={2}>
            {/* Lowercase mono + a green full stop — the design's page-title
                signature (foundation § "Título"). */}
            <Heading as="h1" textStyle="pageTitle" color="text.primary">
              {title}
              <chakra.span color="text.brand" aria-hidden="true">
                .
              </chakra.span>
            </Heading>
            <AnimatePresence>
              {count !== undefined && (
                <MotionText
                  fontSize="sm"
                  fontWeight="500"
                  color="text.muted"
                  whiteSpace="nowrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={TRANSITION_FAST as Transition}
                >
                  {count} {countLabel}
                </MotionText>
              )}
            </AnimatePresence>
          </Flex>
          {description && (
            <Text color="text.secondary" textStyle="body" maxW="2xl">
              {description}
            </Text>
          )}
          {children}
        </Flex>

        {hasActions && (
          <Flex
            align="center"
            gap={2}
            flexShrink={0}
            w={{ base: "full", md: "auto" }}
          >
            {primaryAction && <PrimaryAction action={primaryAction} />}
            {actions}
          </Flex>
        )}
      </Flex>
      <Separator borderColor="border.subtle" />
    </MotionFlex>
  );
}

/**
 * Split out so the icon component (which may come from the caller as
 * `action.icon`) can be bound to a capitalized local — JSX resolves a
 * lowercase tag to an intrinsic element.
 */
function PrimaryAction({ action }: { action: PageHeaderAction }) {
  const ActionIcon = action.icon ?? FiPlus;
  return (
    <Button
      size="xs"
      colorPalette="brand"
      onClick={action.onClick}
      borderRadius="md"
      fontWeight="500"
      fontSize={{ base: "sm", md: "xs" }}
      h={{ base: "44px", md: "30px" }}
      px={3}
      flex={{ base: 1, md: "initial" }}
      _active={{
        transform: "scale(0.98)",
      }}
      transition="all 0.15s ease"
      data-cy="page-header-primary-action"
    >
      <Icon boxSize={3.5}>
        <ActionIcon />
      </Icon>
      {action.label}
    </Button>
  );
}

export const PageHeader = memo(PageHeaderComponent);
