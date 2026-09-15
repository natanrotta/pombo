import { Menu as ChakraMenu, Portal } from "@chakra-ui/react";
import * as React from "react";

interface MenuContentProps extends ChakraMenu.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Chrome ported from the v2 `Menu` theme override. v3 drives the hovered row
 * with `data-highlighted` (keyboard AND pointer), so `_highlighted` replaces the
 * v2 `_hover` + `_focus` pair on the item.
 */
export const MenuContent = React.forwardRef<HTMLDivElement, MenuContentProps>(
  function MenuContent(props, ref) {
    const { portalled = true, portalRef, ...rest } = props;
    return (
      <Portal disabled={!portalled} container={portalRef}>
        <ChakraMenu.Positioner>
          <ChakraMenu.Content
            ref={ref}
            boxShadow="shadow.panel"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.elevated"
            p="1.5"
            minW="180px"
            overflow="hidden"
            {...rest}
          />
        </ChakraMenu.Positioner>
      </Portal>
    );
  },
);

export const MenuItem = React.forwardRef<HTMLDivElement, ChakraMenu.ItemProps>(
  function MenuItem(props, ref) {
    return (
      <ChakraMenu.Item
        ref={ref}
        borderRadius="md"
        fontSize="sm"
        fontWeight="500"
        color="text.primary"
        bg="transparent"
        transition="all 0.15s"
        px="3"
        py="2"
        _highlighted={{ bg: "bg.hover" }}
        {...props}
      />
    );
  },
);

export const MenuSeparator = React.forwardRef<
  HTMLDivElement,
  ChakraMenu.SeparatorProps
>(function MenuSeparator(props, ref) {
  return (
    <ChakraMenu.Separator
      ref={ref}
      borderColor="border.subtle"
      my="1"
      {...props}
    />
  );
});

export const MenuItemGroup = React.forwardRef<
  HTMLDivElement,
  ChakraMenu.ItemGroupProps
>(function MenuItemGroup(props, ref) {
  const { title, children, ...rest } = props;
  return (
    <ChakraMenu.ItemGroup ref={ref} {...rest}>
      {title && (
        <ChakraMenu.ItemGroupLabel userSelect="none">
          {title}
        </ChakraMenu.ItemGroupLabel>
      )}
      {children}
    </ChakraMenu.ItemGroup>
  );
});

export const MenuRoot = ChakraMenu.Root;
export const MenuTrigger = ChakraMenu.Trigger;
export const MenuItemText = ChakraMenu.ItemText;
