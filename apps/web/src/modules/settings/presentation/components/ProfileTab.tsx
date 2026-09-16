import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";
import { ColorModeToggle } from "@/shared/components/ui/ColorModeToggle";

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
        <Flex direction="column" gap={4}>
          <Flex direction="column" gap={0.5}>
            <Text textStyle="sectionTitle" color="text.primary">
              {t("profile.personalData")}
            </Text>
            <Text textStyle="caption" color="text.secondary">
              {t("profile.personalDataDescription")}
            </Text>
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
        </Flex>
      </SectionCard>

      <SectionCard>
        <Flex direction="column" gap={4}>
          <Flex direction="column" gap={0.5}>
            <Text textStyle="sectionTitle" color="text.primary">
              {t("profile.preferences.title")}
            </Text>
            <Text textStyle="caption" color="text.secondary">
              {t("profile.preferences.description")}
            </Text>
          </Flex>

          <PreferenceRow
            title={t("profile.preferences.language")}
            description={t("profile.preferences.languageDescription")}
            control={<LanguageSelector />}
          />
          <PreferenceRow
            title={t("profile.preferences.theme")}
            description={t("profile.preferences.themeDescription")}
            control={<ColorModeToggle />}
            hasDivider
          />
        </Flex>
      </SectionCard>

      <SectionCard>
        <Flex
          align={{ base: "stretch", md: "center" }}
          justify="space-between"
          direction={{ base: "column", md: "row" }}
          gap={3}
        >
          <Flex direction="column" gap={0.5} minW={0}>
            <Text textStyle="sectionTitle" color="text.primary">
              {t("profile.security.title")}
            </Text>
            <Text textStyle="caption" color="text.secondary">
              {t("profile.security.description")}
            </Text>
          </Flex>
          <Button
            variant="outline"
            size="md"
            onClick={handleRequestPasswordReset}
            loading={isRequestingPasswordReset}
            loadingText={t("profile.security.sending")}
            alignSelf={{ base: "flex-start", md: "auto" }}
          >
            <Icon boxSize={3.5} color="text.brand">
              <FiLock />
            </Icon>
            {t("profile.security.changePassword")}
          </Button>
        </Flex>
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

interface PreferenceRowProps {
  title: string;
  description: string;
  control: ReactNode;
  hasDivider?: boolean;
}

/** One preference: what it is on the left, the control on the right. */
function PreferenceRow({
  title,
  description,
  control,
  hasDivider = false,
}: PreferenceRowProps) {
  return (
    <Flex
      align={{ base: "flex-start", md: "center" }}
      justify="space-between"
      direction={{ base: "column", md: "row" }}
      gap={3}
      pt={hasDivider ? 4 : 0}
      borderTopWidth={hasDivider ? "1px" : 0}
      borderColor="border.subtle"
    >
      <Flex direction="column" gap={0.5} minW={0}>
        <Text textStyle="bodyStrong" color="text.primary">
          {title}
        </Text>
        <Text textStyle="caption" color="text.secondary">
          {description}
        </Text>
      </Flex>
      {control}
    </Flex>
  );
}
