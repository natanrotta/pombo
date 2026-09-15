import { memo, useCallback } from "react";
import { Icon, IconButton, type IconButtonProps } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiCopy } from "@/shared/components/icons";
import { useNotify } from "@/shared/hooks/useNotify";

interface CopyButtonProps extends Omit<
  IconButtonProps,
  "aria-label" | "onClick"
> {
  value: string;
  ariaLabel: string;
}

/** Copies `value` to the clipboard and confirms with a toast. Fails silently
 *  when the Clipboard API is unavailable (insecure origin / old browser). */
export const CopyButton = memo(function CopyButton({
  value,
  ariaLabel,
  ...props
}: CopyButtonProps) {
  const { t } = useTranslation("common");
  const { showSuccess } = useNotify();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(t("actions.copied"));
    } catch {
      // Clipboard unavailable — nothing to surface.
    }
  }, [value, showSuccess, t]);

  return (
    <IconButton
      aria-label={ariaLabel}
      size="sm"
      variant="ghost"
      onClick={handleCopy}
      {...props}
    >
      <Icon>
        <FiCopy />
      </Icon>
    </IconButton>
  );
});
