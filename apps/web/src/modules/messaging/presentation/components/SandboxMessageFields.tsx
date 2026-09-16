import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/components/forms/FormField";
import { TextAreaField } from "@/shared/components/forms/TextAreaField";
import {
  isMediaType,
  type SandboxForm,
} from "@/modules/messaging/presentation/utils/sandboxForm";

type ContentField = "text" | "mediaUrl" | "fileName" | "caption";

interface SandboxMessageFieldsProps {
  formData: SandboxForm;
  errors: Partial<Record<keyof SandboxForm, string>>;
  onChange: (field: ContentField, value: string) => void;
}

/** The content fields of the selected message type: the text for text/group
 *  sends; the media string, plus file name (document) and caption (not audio),
 *  for media sends. */
export function SandboxMessageFields({
  formData,
  errors,
  onChange,
}: SandboxMessageFieldsProps) {
  const { t } = useTranslation("sandbox");
  const { messageType } = formData;

  if (messageType === "text" || messageType === "group") {
    return (
      <TextAreaField
        label={t("fields.text")}
        placeholder={t("fields.textPlaceholder")}
        value={formData.text}
        onChange={(value) => onChange("text", value)}
        error={errors.text ? t("errors.textRequired") : undefined}
        rows={6}
      />
    );
  }

  if (!isMediaType(messageType)) return null;

  return (
    <>
      <FormField
        label={t(`fields.media.${messageType}`)}
        placeholder={t("fields.mediaPlaceholder")}
        helperText={t("fields.mediaHelper")}
        value={formData.mediaUrl}
        onChange={(value) => onChange("mediaUrl", value)}
        error={errors.mediaUrl ? t("errors.mediaRequired") : undefined}
      />
      {messageType === "document" && (
        <FormField
          label={t("fields.fileName")}
          placeholder={t("fields.fileNamePlaceholder")}
          value={formData.fileName}
          onChange={(value) => onChange("fileName", value)}
        />
      )}
      {messageType !== "audio" && (
        <FormField
          label={t("fields.caption")}
          placeholder={t("fields.captionPlaceholder")}
          value={formData.caption}
          onChange={(value) => onChange("caption", value)}
        />
      )}
    </>
  );
}
