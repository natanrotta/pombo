import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Grid, Icon, Spinner, Text } from "@chakra-ui/react";
import { Avatar } from "@/components/ui/avatar";
import { FiCamera, FiLock } from "@/shared/components/icons";
import { useTranslation } from "react-i18next";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { SaveButton } from "@/shared/components/ui/SaveButton";
import { FormField } from "@/shared/components/forms/FormField";
import { useAuth } from "@/modules/auth";
import type { UpdateProfileInput } from "@/modules/auth";
import { useNotify } from "@/shared/hooks/useNotify";
import { useErrorHandler } from "@/core/query/useErrorHandler";
import { useDetailPageController } from "@/shared/hooks/useDetailPageController";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";

/** Local form state, seeded from the persisted user on mount. */
type LocalProfileData = {
  name: string;
  email: string;
};

function buildSeed(user: ReturnType<typeof useAuth>["user"]): LocalProfileData {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
  };
}

export function ProfileTab() {
  const { t } = useTranslation("settings");
  const { user, updateProfile, uploadAvatar, requestPasswordReset } = useAuth();
  const { showSuccess } = useNotify();
  const { handleError } = useErrorHandler();

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] =
    useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(
    async (data: LocalProfileData) => {
      const payload: UpdateProfileInput = {
        name: data.name,
        email: data.email,
      };
      try {
        await updateProfile(payload);
      } catch (error) {
        handleError(error, t("profile.profileUpdateError"));
        throw error;
      }
    },
    [updateProfile, handleError, t],
  );

  const {
    localData,
    isDirty,
    isSaving,
    handleFieldChange,
    handleManualSave,
    reset,
  } = useDetailPageController<LocalProfileData>({
    onSave: handleSave,
    delay: 1500,
    flushOnUnmount: true,
    validationSchema: {
      name: (value) => (value.trim() === "" ? "name_empty" : null),
    },
  });
  useUnsavedChangesGuard(isDirty);

  // Seed the controller from the persisted user exactly once.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!user || seededRef.current) return;
    reset(buildSeed(user));
    seededRef.current = true;
  }, [user, reset]);

  const fullName = localData.name ?? "";
  const email = localData.email ?? "";

  const handleRequestPasswordReset = useCallback(async () => {
    if (!user?.email) return;
    setIsRequestingPasswordReset(true);
    try {
      await requestPasswordReset({ email: user.email });
      showSuccess(t("profile.security.resetEmailSent", { email: user.email }));
    } catch (error) {
      handleError(error, t("profile.security.resetEmailError"));
    } finally {
      setIsRequestingPasswordReset(false);
    }
  }, [user?.email, requestPasswordReset, showSuccess, handleError, t]);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setIsUploadingAvatar(true);

      try {
        await uploadAvatar(file);
        showSuccess(t("profile.avatarUpdated"));
      } catch (error) {
        setAvatarPreview(null);
        handleError(error, t("profile.avatarUpdateError"));
      } finally {
        URL.revokeObjectURL(previewUrl);
        setIsUploadingAvatar(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [uploadAvatar, showSuccess, handleError, t],
  );

  return (
    <Flex direction="column" gap={5}>
      <SectionCard>
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "center", md: "center" }}
          gap={4}
        >
          <Box
            position="relative"
            cursor="pointer"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label={t("profile.changeAvatar")}
            flexShrink={0}
          >
            <Avatar
              size="xl"
              src={avatarPreview || user?.avatarUrl || undefined}
              name={user?.name}
              bg="brand.500"
              color="white"
            />
            <Flex
              position="absolute"
              inset={0}
              align="center"
              justify="center"
              bg="blackAlpha.500"
              borderRadius="full"
              opacity={0}
              _hover={{ opacity: 1 }}
              transition="opacity 0.2s"
            >
              {isUploadingAvatar ? (
                <Spinner size="sm" color="white" />
              ) : (
                <Icon color="white" boxSize={5}>
                  <FiCamera />
                </Icon>
              )}
            </Flex>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </Box>

          <Flex
            direction="column"
            gap={0.5}
            minW={0}
            align={{ base: "center", md: "flex-start" }}
            textAlign={{ base: "center", md: "left" }}
          >
            <Text
              fontSize="lg"
              fontWeight="700"
              color="text.primary"
              lineClamp={1}
            >
              {user?.name}
            </Text>
            <Text fontSize="sm" color="text.secondary" lineClamp={1}>
              {user?.email}
            </Text>
          </Flex>
        </Flex>
      </SectionCard>

      <SectionCard>
        <Flex
          align={{ base: "stretch", md: "center" }}
          justify="space-between"
          direction={{ base: "column", md: "row" }}
          gap={3}
          mb={4}
        >
          <Text fontSize="sm" fontWeight="600" color="text.primary">
            {t("profile.personalData")}
          </Text>
          <Button
            size="sm"
            variant="outline"
            colorPalette="brand"
            onClick={handleRequestPasswordReset}
            loading={isRequestingPasswordReset}
            loadingText={t("profile.security.sending")}
            alignSelf={{ base: "flex-start", md: "auto" }}
          >
            <Icon boxSize={3.5}>
              <FiLock />
            </Icon>
            {t("profile.security.changePassword")}
          </Button>
        </Flex>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          <FormField
            label={t("profile.fullName")}
            value={fullName}
            onChange={(v) => handleFieldChange("name", v)}
          />
          <FormField
            label={t("profile.email")}
            value={email}
            onChange={(v) => handleFieldChange("email", v)}
          />
        </Grid>
      </SectionCard>

      <Flex justify="flex-end">
        <SaveButton
          isDirty={isDirty}
          isSaving={isSaving}
          onClick={handleManualSave}
        />
      </Flex>
    </Flex>
  );
}
