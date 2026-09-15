import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AppError } from "@/core/errors/AppError";
import { ErrorCodes } from "@/core/errors/errorCodes";
import { toaster } from "@/components/ui/toaster";

export function useNotify() {
  const { t } = useTranslation("common");

  const showSuccess = useCallback((title: string) => {
    toaster.create({ type: "success", title, duration: 2500 });
  }, []);

  const showAutoSaved = useCallback(
    (title = t("notify.autoSaved")) => {
      toaster.create({ type: "info", title, duration: 1500 });
    },
    [t],
  );

  const showInfo = useCallback((title: string) => {
    toaster.create({ type: "info", title, duration: 2500 });
  }, []);

  const showWarning = useCallback((title: string) => {
    toaster.create({ type: "warning", title, duration: 3000 });
  }, []);

  const showError = useCallback(
    (error: unknown, fallbackMessage = t("notify.defaultError")) => {
      let message = fallbackMessage;

      if (error instanceof AppError) {
        message = error.message;

        if (error.code === ErrorCodes.VALIDATION_ERROR && error.details) {
          const details = error.details as Record<string, string[]>;
          const fieldErrors = Object.values(details).flat();
          if (fieldErrors.length > 0) {
            message = fieldErrors.join(". ");
          }
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      // Dedupe identical errors so a misbehaving form (autosave loop,
      // double-click) can't stack the same toast on top of itself.
      // Truncate the keying surface so a long error message doesn't
      // produce an unbounded toast id.
      const id = `error:${message.slice(0, 80)}`;
      if (toaster.isVisible(id)) return;

      toaster.create({
        id,
        type: "error",
        title: t("notify.errorTitle"),
        description: message,
        duration: 4000,
      });
    },
    [t],
  );

  return { showSuccess, showAutoSaved, showInfo, showWarning, showError };
}
