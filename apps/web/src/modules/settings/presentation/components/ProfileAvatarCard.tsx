import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Box, Flex, Icon, Spinner, Text, chakra } from "@chakra-ui/react";
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
        handleError(error, t("profile.avatarUpdateError"));
      } finally {
        // The blob is revoked below, so the avatar goes back to the user's
        // URL — the server's new one after a success, the old one otherwise.
        setPreview(null);
        URL.revokeObjectURL(previewUrl);
        setIsUploading(false);
        input.value = "";
      }
    },
    [uploadAvatar, showSuccess, handleError, t],
  );

  return (
    <SectionCard>
      <Flex align="center" gap={4.5} wrap="wrap">
        <Box position="relative" flexShrink={0}>
          <Avatar
            size="xl"
            src={preview || user?.avatarUrl || undefined}
            name={user?.name}
            bg="bg.brand.subtle"
            color="text.brand"
            boxShadow="inset 0 0 0 1px var(--chakra-colors-border-accent)"
          />
          {/* The camera sits on the avatar's edge, like a badge. */}
          <chakra.button
            type="button"
            aria-label={t("profile.changeAvatar")}
            aria-busy={isUploading}
            onClick={() => fileInputRef.current?.click()}
            position="absolute"
            right="-2px"
            bottom="-2px"
            w="25px"
            h="25px"
            display="grid"
            placeItems="center"
            borderRadius="full"
            borderWidth="2px"
            borderColor="bg.surface"
            bg="bg.brand.solid"
            color="text.onBrand"
            cursor="pointer"
            transition="background-color 150ms ease"
            _hover={{ bg: "bg.brand.solid-hover" }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "border.focus",
              outlineOffset: "2px",
            }}
          >
            {isUploading ? (
              <Spinner size="xs" />
            ) : (
              <Icon boxSize={3}>
                <FiCamera />
              </Icon>
            )}
          </chakra.button>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleFileChange}
          hidden
        />

        <Flex direction="column" gap={1} minW={0} flex="1 1 180px">
          <Text fontSize="19px" fontWeight="600" color="text.primary" lineClamp={1}>
            {user?.name}
          </Text>
          <Text textStyle="mono" fontSize="13px" color="text.muted" lineClamp={1}>
            {user?.email}
          </Text>
        </Flex>
      </Flex>
    </SectionCard>
  );
}
