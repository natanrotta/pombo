import { useTranslation } from "react-i18next";
import { PageHeader } from "@/shared/components/ui/PageHeader";
import { ProfileTab } from "@/modules/settings/presentation/components/ProfileTab";

/** Standalone "Perfil" screen: identity, personal data, browser preferences
 *  (language + theme) and the password action. */
export function ProfilePage() {
  const { t } = useTranslation("settings");

  return (
    <>
      <PageHeader
        title={t("profilePage.title")}
        description={t("profilePage.description")}
      />
      <ProfileTab />
    </>
  );
}
