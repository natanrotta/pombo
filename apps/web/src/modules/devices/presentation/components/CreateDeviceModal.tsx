import { useCallback, useState } from "react";
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle } from "@/shared/components/icons";
import { AppModal } from "@/shared/components/ui/AppModal";
import { CopyButton } from "@/shared/components/ui/CopyButton";
import { FormField } from "@/shared/components/forms/FormField";
import { useFormState } from "@/shared/hooks/useFormState";
import { useNotify } from "@/shared/hooks/useNotify";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useCreateDevice } from "@/modules/devices/presentation/hooks/useDevices";
import type { CreatedDevice } from "@/modules/devices/domain/entities/Device";

interface CreateDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Two-step create flow: (1) name form → (2) one-time webhookSecret reveal, then
 * navigate to the new device's detail page. The secret is shown exactly once —
 * the modal never re-fetches it.
 */
export function CreateDeviceModal({ isOpen, onClose }: CreateDeviceModalProps) {
  const { t } = useTranslation("devices");
  const navigate = useNavigate();
  const { showSuccess } = useNotify();
  const createDevice = useCreateDevice();

  const [created, setCreated] = useState<CreatedDevice | null>(null);
  const form = useFormState<{ name: string }>(
    { name: "" },
    { name: (value) => (value.trim() === "" ? "required" : null) },
  );

  const handleClose = useCallback(() => {
    setCreated(null);
    form.reset({ name: "" });
    onClose();
  }, [form, onClose]);

  const handleCreate = useCallback(async () => {
    if (!form.validate()) return;
    try {
      const result = await createDevice.mutateAsync({
        name: form.formData.name.trim(),
      });
      setCreated(result);
      showSuccess(t("create.success"));
    } catch {
      // Error surfaced by the mutation's onError toast.
    }
  }, [form, createDevice, showSuccess, t]);

  const handleGoToDevice = useCallback(() => {
    if (!created) return;
    const path = ROUTE_PATHS.deviceDetail.replace(":id", created.id);
    handleClose();
    navigate(path);
  }, [created, handleClose, navigate]);

  if (created) {
    return (
      <AppModal
        isOpen={isOpen}
        onClose={handleGoToDevice}
        title={t("secret.title")}
        primaryActionLabel={t("secret.goToDevice")}
        onPrimaryAction={handleGoToDevice}
      >
        <Flex direction="column" gap={4}>
          <Flex
            align="flex-start"
            gap={3}
            bg="status.warning.bg"
            borderRadius="md"
            p={3}
          >
            <Icon color="status.warning.fg" mt={0.5}>
              <FiAlertTriangle />
            </Icon>
            <Text fontSize="sm" color="text.primary">
              {t("secret.warning")}
            </Text>
          </Flex>

          <Box>
            <Text fontSize="xs" color="text.secondary" mb={1}>
              {t("secret.label")}
            </Text>
            <Flex align="center" gap={2}>
              <FormField
                aria-label={t("secret.label")}
                value={created.webhookSecret}
                onChange={() => undefined}
                readOnly
                fontFamily="mono"
                fontSize="sm"
              />
              <CopyButton
                value={created.webhookSecret}
                ariaLabel={t("secret.copy")}
              />
            </Flex>
          </Box>
        </Flex>
      </AppModal>
    );
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("create.title")}
      primaryActionLabel={t("create.submit")}
      onPrimaryAction={handleCreate}
      isPrimaryLoading={createDevice.isPending}
      onCancelAction={handleClose}
    >
      <FormField
        label={t("create.nameLabel")}
        placeholder={t("create.namePlaceholder")}
        value={form.formData.name}
        onChange={(value) => form.setField("name", value)}
        error={form.errors.name ? t("create.errors.required") : undefined}
        autoFocus
      />
    </AppModal>
  );
}
