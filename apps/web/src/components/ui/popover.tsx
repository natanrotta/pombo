import { Popover as ChakraPopover, Portal } from "@chakra-ui/react";
import { CloseButton } from "@/components/ui/close-button";
import * as React from "react";

interface PopoverContentProps extends ChakraPopover.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
}

/** Chrome ported from the v2 `Popover` theme override. */
export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(function PopoverContent(props, ref) {
  const { portalled = true, portalRef, ...rest } = props;
  return (
    <Portal disabled={!portalled} container={portalRef}>
      <ChakraPopover.Positioner>
        <ChakraPopover.Content
          ref={ref}
          bg="bg.elevated"
          borderColor="border.subtle"
          color="text.primary"
          boxShadow="shadow.panel"
          {...rest}
        />
      </ChakraPopover.Positioner>
    </Portal>
  );
});

export const PopoverArrow = React.forwardRef<
  HTMLDivElement,
  ChakraPopover.ArrowProps
>(function PopoverArrow(props, ref) {
  return (
    <ChakraPopover.Arrow {...props} ref={ref}>
      <ChakraPopover.ArrowTip bg="bg.elevated" />
    </ChakraPopover.Arrow>
  );
});

export const PopoverHeader = React.forwardRef<
  HTMLDivElement,
  ChakraPopover.HeaderProps
>(function PopoverHeader(props, ref) {
  return (
    <ChakraPopover.Header
      ref={ref}
      borderColor="border.subtle"
      color="text.primary"
      {...props}
    />
  );
});

export const PopoverFooter = React.forwardRef<
  HTMLDivElement,
  ChakraPopover.FooterProps
>(function PopoverFooter(props, ref) {
  return (
    <ChakraPopover.Footer ref={ref} borderColor="border.subtle" {...props} />
  );
});

export const PopoverCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraPopover.CloseTriggerProps
>(function PopoverCloseTrigger(props, ref) {
  return (
    <ChakraPopover.CloseTrigger
      position="absolute"
      top="1"
      insetEnd="1"
      {...props}
      asChild
      ref={ref}
    >
      <CloseButton size="sm" />
    </ChakraPopover.CloseTrigger>
  );
});

export const PopoverRoot = ChakraPopover.Root;
export const PopoverTrigger = ChakraPopover.Trigger;
export const PopoverAnchor = ChakraPopover.Anchor;
export const PopoverBody = ChakraPopover.Body;
export const PopoverTitle = ChakraPopover.Title;
export const PopoverDescription = ChakraPopover.Description;
