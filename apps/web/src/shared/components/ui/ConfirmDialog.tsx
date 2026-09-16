import { Button } from "@chakra-ui/react";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  isDanger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  isDanger = true,
}: ConfirmDialogProps) {
  const { t } = useTranslation("common");

  const resolvedTitle = title ?? t("confirmDialog.defaultTitle");
  const resolvedDescription =
    description ?? t("confirmDialog.defaultDescription");
  const resolvedConfirmLabel = confirmLabel ?? t("actions.confirm");
  const resolvedCancelLabel = cancelLabel ?? t("actions.cancel");

  return (
    // v3 folded AlertDialog into Dialog: `role="alertdialog"` is what makes
    // assistive tech announce it as a decision. `initialFocusEl` replaces v2's
    // `leastDestructiveRef` — focus lands on Cancel, not on the destructive CTA.
    <DialogRoot
      role="alertdialog"
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
      placement="center"
      initialFocusEl={() =>
        document.querySelector<HTMLButtonElement>("[data-confirm-cancel]")
      }
    >
      <DialogContent data-cy="confirm-dialog" borderRadius="lg" mx={{ base: 4, md: 0 }}>
        <DialogHeader>
          <DialogTitle fontSize="md" fontWeight="700">
            {resolvedTitle}
          </DialogTitle>
        </DialogHeader>
        <DialogBody fontSize="sm" color="text.secondary">
          {resolvedDescription}
        </DialogBody>
        <DialogFooter gap={2}>
          <Button
            data-confirm-cancel
            data-cy="confirm-dialog-cancel"
            size="sm"
            variant="ghost"
            onClick={onClose}
          >
            {resolvedCancelLabel}
          </Button>
          <Button
            data-cy="confirm-dialog-confirm"
            size="sm"
            // The button recipe paints `solid` with the brand tokens and ignores
            // `colorPalette` (`colorPalette="red"` rendered this green), so the
            // destructive CTA uses the recipe's own `danger` variant. Chakra's
            // generated types don't know the custom variant name.
            variant={(isDanger ? "danger" : "solid") as "solid"}
            onClick={onConfirm}
            loading={isLoading}
          >
            {resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
