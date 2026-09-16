import { memo } from "react";
import { Box, Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { TRANSITION_SLOW } from "@/shared/constants/animation";
import type { IconType } from "@/shared/components/icons";
import type { ReactNode } from "react";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/shared/components/ui/ActionMenu";

const MotionBox = motion.create(Box);

interface EntityCardMetaItem {
  icon: IconType;
  label: string;
  color?: string;
}

export interface EntityCardQuickAction {
  icon: IconType;
  label: string;
  onClick: () => void;
}

interface EntityCardProps {
  avatar?: ReactNode;
  /** A live entity breathes (the design's only continuous animation). */
  isLive?: boolean;
  /** Footer call to action, revealed on hover/focus ("abrir →"). */
  hoverAction?: string;
  title: string;
  subtitle?: string;
  badges?: ReactNode[];
  metaItems?: EntityCardMetaItem[];
  actionItems?: ActionMenuItem[];
  quickActions?: EntityCardQuickAction[];
  footerEnd?: ReactNode;
  onClick?: () => void;
  /**
   * Fired on `mouseenter` / `focus`. Hook a `queryClient.prefetchQuery`
   * here to warm the detail cache before the user clicks the card.
   */
  onHover?: () => void;
}

export const EntityCard = memo(function EntityCard({
  avatar,
  isLive = false,
  hoverAction,
  title,
  subtitle,
  badges,
  metaItems,
  actionItems,
  quickActions,
  footerEnd,
  onClick,
  onHover,
}: EntityCardProps) {
  return (
    <MotionBox
      data-cy="entity-card"
      bg="bg.surface"
      borderWidth="1px"
      // A live entity rests on a green edge and breathes; everything else
      // carries the plain border.
      borderColor={isLive ? "border.accent" : "border.default"}
      borderRadius="lg"
      boxShadow="shadow.card"
      animation={isLive ? "livePulse 3.4s ease-in-out infinite" : undefined}
      p={4}
      h="100%"
      display="flex"
      flexDirection="column"
      style={{
        transition: "border-color 150ms ease, box-shadow 150ms ease",
      }}
      cursor={onClick ? "pointer" : undefined}
      onClick={onClick}
      // onFocus bubbles up from inner focusable buttons (ActionMenu /
      // quickActions), so keyboard users get the prefetch without us
      // making the whole card focusable.
      onMouseEnter={onHover}
      onFocus={onHover}
      // Chakra v3's `_groupHover` matches the `group` class, not `role="group"`.
      className="group"
      // The design moves in color, not in space: the edge lights up, the card
      // stays put.
      _hover={onClick ? { borderColor: "border.brand" } : undefined}
      position="relative"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_SLOW}
    >
      <Flex justify="space-between" align="flex-start" mb={3}>
        <Flex align="center" gap={3} flex={1} minW={0}>
          {avatar}
          <Box flex={1} minW={0}>
            <Tooltip
              content={title}
              contentProps={{ fontSize: "xs" }}
              openDelay={400}
              showArrow
              positioning={{ placement: "top" }}
            >
              <Text fontWeight="500" fontSize="16.5px" lineClamp={1}>
                {title}
              </Text>
            </Tooltip>
            {subtitle && (
              <Text textStyle="mono" color="text.muted" lineClamp={1} mt={1}>
                {subtitle}
              </Text>
            )}
          </Box>
        </Flex>
        {actionItems && actionItems.length > 0 && (
          <Box onClick={(e) => e.stopPropagation()} flexShrink={0}>
            <ActionMenu items={actionItems} />
          </Box>
        )}
      </Flex>

      {badges && badges.length > 0 && (
        <Flex gap={1.5} flexWrap="wrap" align="center" mb={3}>
          {badges}
        </Flex>
      )}

      {(metaItems && metaItems.length > 0) ||
      (quickActions && quickActions.length > 0) ||
      hoverAction ||
      footerEnd ? (
        <Flex
          align={{
            base:
              quickActions && quickActions.length > 0 ? "flex-end" : "center",
            md: "center",
          }}
          gap={3}
          pt={3}
          mt="auto"
          borderTopWidth="1px"
          borderColor="border.subtle"
          minW={0}
        >
          {/* Meta stacks vertically on mobile so the items don't crowd into a
              single clipped row; reverts to a scrollable row from md up. */}
          <Flex
            direction={{ base: "column", md: "row" }}
            align={{ base: "flex-start", md: "center" }}
            gap={{ base: 1.5, md: 3 }}
            flex={1}
            minW={0}
            overflowX={{ base: "visible", md: "auto" }}
            css={{
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {metaItems?.map((meta) => (
              <Flex key={meta.label} align="center" gap={1.5} flexShrink={0}>
                <Icon
                  boxSize={3.5}
                  color={meta.color ?? "text.muted"}
                  flexShrink={0}
                >
                  <meta.icon />
                </Icon>
                <Text
                  textStyle="mono"
                  color={meta.color ?? "text.muted"}
                  whiteSpace="nowrap"
                >
                  {meta.label}
                </Text>
              </Flex>
            ))}
          </Flex>
          {hoverAction && (
            <Text
              textStyle="mono"
              fontWeight="500"
              color="text.brand"
              whiteSpace="nowrap"
              flexShrink={0}
              opacity={{ base: 1, md: 0 }}
              _groupHover={{ opacity: 1 }}
              _groupFocusWithin={{ opacity: 1 }}
              transition="opacity 150ms ease"
            >
              {hoverAction} →
            </Text>
          )}
          {footerEnd && (
            <Flex
              flexShrink={0}
              onClick={(e) => e.stopPropagation()}
              align="center"
            >
              {footerEnd}
            </Flex>
          )}
          {quickActions && quickActions.length > 0 && (
            <Flex
              gap={1}
              flexShrink={0}
              onClick={(e) => e.stopPropagation()}
              opacity={{ base: 1, md: 0 }}
              _groupHover={{ opacity: 1 }}
              _focusWithin={{ opacity: 1 }}
              transition="opacity 0.15s ease"
            >
              {quickActions.map((action) => (
                <Tooltip
                  key={action.label}
                  content={action.label}
                  contentProps={{ fontSize: "xs" }}
                  showArrow
                >
                  <IconButton
                    aria-label={action.label}
                    size="xs"
                    variant="ghost"
                    color="text.secondary"
                    _hover={{ color: "text.brand", bg: "bg.brand.subtle" }}
                    onClick={action.onClick}
                  >
                    <Icon boxSize={3.5}>
                      <action.icon />
                    </Icon>
                  </IconButton>
                </Tooltip>
              ))}
            </Flex>
          )}
        </Flex>
      ) : null}
    </MotionBox>
  );
});
