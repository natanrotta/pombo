import {
  ALLOWED_IMAGE_MIME_TYPES,
  type AllowedImageMimeType,
} from "@pombo/shared-types";

/**
 * The image MIME allowlist for user uploads (declared once in
 * `@pombo/shared-types`, which the web also checks before sending), and the
 * file extension each one maps to. Shared by the upload middleware (which
 * rejects everything else at the edge) and the use cases that build the S3
 * object key — so the extension stored is derived from the VALIDATED type,
 * never from the client-supplied filename (SEC-H6).
 */
export { ALLOWED_IMAGE_MIME_TYPES, type AllowedImageMimeType };

export const IMAGE_MIME_EXTENSION: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedImageMimeType(
  value: string,
): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}
