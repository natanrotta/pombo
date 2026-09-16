import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Flex, Grid, Icon, Text } from "@chakra-ui/react";
import { FiLock } from "@/shared/components/icons";
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
import { ProfileAvatarCard } from "@/modules/settings/presentation/components/ProfileAvatarCard";

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
  const { user, updateProfile, requestPasswordReset } = useAuth();
  const { showSuccess } = useNotify();
  const { handleError } = useErrorHandler();

  const [isRequestingPasswordReset, setIsRequestingPasswordReset] =
    useState(false);

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
    errors,
    handleFieldChange,
    handleManualSave,
    reset,
  } = useDetailPageController<LocalProfileData>({
    onSave: handleSave,
    delay: 1500,
    flushOnUnmount: true,
    validationSchema: {
      // Returns an i18n key; the field renders its translation.
      name: (value) => (value.trim() === "" ? "profile.nameRequired" : null),
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

  return (
    <Flex direction="column" gap={5}>
      <ProfileAvatarCard />

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
            error={errors.name ? t(errors.name) : undefined}
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
