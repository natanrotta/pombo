/**
 * The image MIME allowlist for user uploads, and the file extension each one
 * maps to. Single source of truth shared by the upload middleware (which
 * rejects everything else at the edge) and the use cases that build the S3
 * object key — so the extension stored is derived from the VALIDATED type,
 * never from the client-supplied filename (SEC-H6).
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

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
