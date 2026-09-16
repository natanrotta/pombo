import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Flex, Icon, Image, Skeleton, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { ErrorCodes } from "@pombo/shared-types";
import { FiAlertTriangle, FiSlash } from "@/shared/components/icons";
import { AppModal } from "@/shared/components/ui/AppModal";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { useNotify } from "@/shared/hooks/useNotify";
import { AppError } from "@/core/errors/AppError";
import {
  useConnectDevice,
  useDeviceQr,
  useRefreshDevice,
} from "@/modules/devices/presentation/hooks/useDevices";

interface QrConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
}

/**
 * Opens a WhatsApp pairing session: fires `connect` once, then polls the QR
 * every 3s while open. Renders the QR string as an image; when the device
 * reports CONNECTED it toasts success, refreshes the device caches, and closes.
 * If the connect call fails it stops polling and shows an in-modal retry — never
 * a terminal skeleton.
 */
export function QrConnectModal({
  isOpen,
  onClose,
  deviceId,
}: QrConnectModalProps) {
  const { t } = useTranslation("devices");
  const { showSuccess } = useNotify();
  const refreshDevice = useRefreshDevice();
  const { mutate: connectMutate } = useConnectDevice();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // Why the pairing session didn't start: the WhatsApp gateway is switched off
  // in this environment (nothing to retry), or any other failure (retryable).
  const [connectFailure, setConnectFailure] = useState<
    "gatewayDisabled" | "failed" | null
  >(null);
  const connectStartedRef = useRef(false);
  const connectedRef = useRef(false);

  // Poll only while open AND the pairing session actually started (a failed
  // connect has no session behind it — stop hammering /qr until the user retries).
  const qrQuery = useDeviceQr(deviceId, isOpen && connectFailure === null);

  const startConnect = useCallback(() => {
    setConnectFailure(null);
    connectStartedRef.current = true;
    connectMutate(deviceId, {
      // The hook's onError already toasts. Surface an in-modal recovery path
      // instead of trapping the user on an endless skeleton.
      onError: (error) => {
        connectStartedRef.current = false;
        const gatewayDisabled =
          error instanceof AppError &&
          error.code === ErrorCodes.WA_GATEWAY_DISABLED;
        setConnectFailure(gatewayDisabled ? "gatewayDisabled" : "failed");
      },
    });
  }, [connectMutate, deviceId]);

  // Fire the connect exactly once when the modal opens; reset on close.
  useEffect(() => {
    if (!isOpen) {
      connectStartedRef.current = false;
      connectedRef.current = false;
      setQrDataUrl(null);
      setConnectFailure(null);
      return;
    }
    if (connectStartedRef.current) return;
    startConnect();
  }, [isOpen, startConnect]);

  // Render the live QR string to a data URL whenever it rotates.
  const qr = qrQuery.data?.qr ?? null;
  useEffect(() => {
    if (!qr) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qr, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qr]);

  // On CONNECTED: refresh caches, toast, close — exactly once.
  const status = qrQuery.data?.status;
  useEffect(() => {
    if (status !== "CONNECTED" || connectedRef.current) return;
    connectedRef.current = true;
    showSuccess(t("qr.connected"));
    refreshDevice(deviceId);
    onClose();
  }, [status, deviceId, showSuccess, t, refreshDevice, onClose]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("qr.title")}
      onCancelAction={onClose}
      cancelActionLabel={t("qr.close")}
    >
      <Flex direction="column" align="center" gap={4} py={2}>
        {connectFailure === "gatewayDisabled" ? (
          <EmptyState
            icon={FiSlash}
            title={t("qr.gatewayDisabled.title")}
            description={t("qr.gatewayDisabled.description")}
            size="sm"
          />
        ) : connectFailure === "failed" ? (
          <Flex direction="column" align="center" gap={3} py={4}>
            <Icon color="status.error.fg" boxSize={8}>
              <FiAlertTriangle />
            </Icon>
            <Text fontSize="sm" color="text.secondary" textAlign="center">
              {t("qr.error")}
            </Text>
            <Button onClick={startConnect}>
              {t("qr.retry")}
            </Button>
          </Flex>
        ) : (
          <>
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={t("qr.alt")}
                boxSize="240px"
                borderRadius="md"
              />
            ) : (
              <Skeleton boxSize="240px" borderRadius="md" />
            )}
            <Text fontSize="sm" color="text.secondary" textAlign="center">
              {qrDataUrl ? t("qr.scan") : t("qr.waiting")}
            </Text>
          </>
        )}
      </Flex>
    </AppModal>
  );
}
