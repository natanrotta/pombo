import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Flex, Icon, Spinner, Text, chakra } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
} from "@pombo/shared-types";
import { Avatar } from "@/components/ui/avatar";
import { FiCamera } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";
import { useNotify } from "@/shared/hooks/useNotify";
import { useErrorHandler } from "@/core/query/useErrorHandler";
import { useAuth } from "@/modules/auth";

const ACCEPTED_IMAGE_TYPES = ALLOWED_IMAGE_MIME_TYPES.join(",");

/** The i18n key explaining why `file` can't be uploaded, or null when it can.
 *  Mirrors the API's upload rules so a bad file never leaves the browser. */
function avatarFileProblem(file: File): string | null {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "profile.avatarInvalidType";
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) return "profile.avatarTooLarge";
  return null;
}

/** Avatar (click or keyboard to replace it) with the user's name and e-mail. */
export function ProfileAvatarCard() {
  const { t } = useTranslation("settings");
  const { user, uploadAvatar } = useAuth();
  const { showSuccess } = useNotify();
  const { handleError } = useErrorHandler();

  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      if (!file) return;

      const problem = avatarFileProblem(file);
      if (problem) {
        input.value = "";
        handleError(undefined, t(problem));
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      setIsUploading(true);
      try {
        await uploadAvatar(file);
        showSuccess(t("profile.avatarUpdated"));
      } catch (error) {
        setPreview(null);
        handleError(error, t("profile.avatarUpdateError"));
      } finally {
        URL.revokeObjectURL(previewUrl);
        setIsUploading(false);
        input.value = "";
      }
    },
    [uploadAvatar, showSuccess, handleError, t],
  );

  return (
    <SectionCard>
      <Flex
        direction={{ base: "column", md: "row" }}
        align="center"
        gap={4}
      >
        <chakra.button
          type="button"
          className="group"
          position="relative"
          flexShrink={0}
          borderRadius="full"
          cursor="pointer"
          aria-label={t("profile.changeAvatar")}
          aria-busy={isUploading}
          onClick={() => fileInputRef.current?.click()}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "border.focus",
            outlineOffset: "2px",
          }}
        >
          <Avatar
            size="xl"
            src={preview || user?.avatarUrl || undefined}
            name={user?.name}
            bg="bg.brand.solid"
            color="text.onBrand"
          />
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            bg="bg.overlay"
            borderRadius="full"
            // Always visible while uploading, so the spinner can be seen.
            opacity={isUploading ? 1 : 0}
            _groupHover={{ opacity: 1 }}
            _groupFocusVisible={{ opacity: 1 }}
            transition="opacity 0.2s"
          >
            {isUploading ? (
              <Spinner size="sm" color="white" />
            ) : (
              <Icon color="white" boxSize={5}>
                <FiCamera />
              </Icon>
            )}
          </Flex>
        </chakra.button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleFileChange}
          hidden
        />

        <Flex
          direction="column"
          gap={0.5}
          minW={0}
          align={{ base: "center", md: "flex-start" }}
          textAlign={{ base: "center", md: "left" }}
        >
          <Text fontSize="lg" fontWeight="700" color="text.primary" lineClamp={1}>
            {user?.name}
          </Text>
          <Text fontSize="sm" color="text.secondary" lineClamp={1}>
            {user?.email}
          </Text>
        </Flex>
      </Flex>
    </SectionCard>
  );
}
