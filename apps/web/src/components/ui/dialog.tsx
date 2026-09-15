import { Dialog as ChakraDialog, Portal } from "@chakra-ui/react";
import { CloseButton } from "@/components/ui/close-button";
import * as React from "react";

interface DialogContentProps extends ChakraDialog.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
  backdrop?: boolean;
}

/**
 * The chrome below is the v2 `Modal` theme override, moved here: v3 renders
 * dialogs exclusively through this snippet, so one definition point beats a
 * slotRecipe that would have to survive a config merge. `rest` stays last so a
 * call site can still override (e.g. a flush-content viewer dialog).
 */
export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(props, ref) {
  const {
    children,
    portalled = true,
    portalRef,
    backdrop = true,
    ...rest
  } = props;

  return (
    <Portal disabled={!portalled} container={portalRef}>
      {/* The live dialogs (AppModal, ConfirmDialog) both overrode the v2 theme
          overlay with this lighter scrim, so it is the real default here. */}
      {backdrop && (
        <ChakraDialog.Backdrop bg="blackAlpha.300" backdropFilter="blur(2px)" />
      )}
      <ChakraDialog.Positioner>
        <ChakraDialog.Content
          ref={ref}
          borderRadius="2xl"
          bg="bg.elevated"
          boxShadow="shadow.lg"
          overflow="hidden"
          {...rest}
          asChild={false}
        >
          {children}
        </ChakraDialog.Content>
      </ChakraDialog.Positioner>
    </Portal>
  );
});

export const DialogHeader = React.forwardRef<
  HTMLDivElement,
  ChakraDialog.HeaderProps
>(function DialogHeader(props, ref) {
  return (
    <ChakraDialog.Header
      ref={ref}
      fontSize="md"
      fontWeight="600"
      color="text.primary"
      pb="2"
      {...props}
    />
  );
});

export const DialogBody = React.forwardRef<
  HTMLDivElement,
  ChakraDialog.BodyProps
>(function DialogBody(props, ref) {
  return <ChakraDialog.Body ref={ref} color="text.primary" py="4" {...props} />;
});

export const DialogFooter = React.forwardRef<
  HTMLDivElement,
  ChakraDialog.FooterProps
>(function DialogFooter(props, ref) {
  return <ChakraDialog.Footer ref={ref} pt="2" {...props} />;
});

export const DialogCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraDialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <ChakraDialog.CloseTrigger
      position="absolute"
      top="2"
      insetEnd="2"
      {...props}
      asChild
    >
      <CloseButton size="sm" ref={ref}>
        {props.children}
      </CloseButton>
    </ChakraDialog.CloseTrigger>
  );
});

export const DialogRoot = ChakraDialog.Root;
export const DialogBackdrop = ChakraDialog.Backdrop;
export const DialogTitle = ChakraDialog.Title;
export const DialogDescription = ChakraDialog.Description;
export const DialogTrigger = ChakraDialog.Trigger;
export const DialogActionTrigger = ChakraDialog.ActionTrigger;
