import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AppError, isRateLimitError } from "@/core/errors/AppError";
import { ErrorCodes, type ValidationErrorDetails } from "@pombo/shared-types";
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

        // A 429 is never a validation error: at most one branch applies.
        const wait = isRateLimitError(error) ? formatRetryAfter(error) : null;
        if (wait) {
          const sentence = /[.!?]$/.test(message) ? message : `${message}.`;
          message = `${sentence} ${t("notify.retryIn", { time: wait })}`;
        } else if (error.code === ErrorCodes.VALIDATION_ERROR) {
          const messages = validationMessages(error.details);
          if (messages.length > 0) message = messages.join(". ");
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

/** `Retry-After` seconds as a short wait ("30 s", "15 min"); null when absent
 *  or not a positive number (the header may also carry an HTTP date). */
function formatRetryAfter(error: AppError): string | null {
  const retryAfter = (error.details as { retryAfter?: unknown } | undefined)
    ?.retryAfter;
  if (typeof retryAfter !== "number" || !Number.isFinite(retryAfter) || retryAfter <= 0) {
    return null;
  }
  return retryAfter < 60
    ? `${Math.ceil(retryAfter)} s`
    : `${Math.ceil(retryAfter / 60)} min`;
}

/** Every message in a VALIDATION_ERROR's details — the API sends Zod's
 *  `flatten()` output (`{ formErrors, fieldErrors }`). */
function validationMessages(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const { formErrors, fieldErrors } = details as Partial<ValidationErrorDetails>;
  return [
    ...(Array.isArray(formErrors) ? formErrors : []),
    ...Object.values(fieldErrors ?? {}).flatMap((messages) => messages ?? []),
  ].filter((message): message is string => typeof message === "string");
}
