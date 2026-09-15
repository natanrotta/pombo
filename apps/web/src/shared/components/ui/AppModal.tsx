import { Button, Flex } from "@chakra-ui/react";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AppModalProps extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** v3 dialog sizes. The v2 union also listed "2xl"/"3xl", which v3 has no
   *  recipe for — no call site passed either, so they are dropped rather than
   *  kept as props that silently render at the default size. */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "cover" | "full";
  borderRadius?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  isPrimaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  primaryColorScheme?: string;
  footerLeft?: ReactNode;
  /**
   * Overrides the footer cancel button. By default it just closes the modal;
   * pass an action (e.g. "discard this draft") + label when cancelling means
   * more than closing. The X / overlay close keeps calling `onClose`.
   */
  onCancelAction?: () => void;
  cancelActionLabel?: string;
  isCancelLoading?: boolean;
  /**
   * Chakra scroll strategy. Pass "inside" for tall bodies (long lists) so the
   * body scrolls while the header + footer stay pinned — keeps the CTA visible.
   */
  scrollBehavior?: "inside" | "outside";
}

export function AppModal({
  isOpen,
  onClose,
  title,
  size,
  borderRadius = "lg",
  primaryActionLabel,
  onPrimaryAction,
  isPrimaryLoading,
  isPrimaryDisabled,
  primaryColorScheme = "brand",
  footerLeft,
  onCancelAction,
  cancelActionLabel,
  isCancelLoading,
  scrollBehavior,
  children,
}: AppModalProps) {
  const { t } = useTranslation("common");

  return (
    // `onOpenChange` fires for every dismissal route (X, overlay, Esc); routing
    // only the close transition to `onClose` keeps the v2 contract exactly.
    <DialogRoot
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
      size={size}
      scrollBehavior={scrollBehavior}
      placement="center"
    >
      <DialogContent borderRadius={borderRadius} mx={{ base: 3, md: 0 }}>
        <DialogHeader>
          <DialogTitle fontSize={{ base: "md", md: "lg" }}>{title}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger aria-label={t("actions.close")} />
        <DialogBody>{children}</DialogBody>
        <DialogFooter
          flexDirection={{ base: "column-reverse", sm: "row" }}
          gap={2}
        >
          {footerLeft && <Flex mr="auto">{footerLeft}</Flex>}
          <Button
            variant="ghost"
            onClick={onCancelAction ?? onClose}
            loading={isCancelLoading}
            w={{ base: "full", sm: "auto" }}
          >
            {cancelActionLabel ?? t("actions.cancel")}
          </Button>
          {primaryActionLabel && onPrimaryAction ? (
            <Button
              colorPalette={primaryColorScheme}
              onClick={onPrimaryAction}
              loading={isPrimaryLoading}
              disabled={isPrimaryDisabled}
              w={{ base: "full", sm: "auto" }}
            >
              {primaryActionLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
