// ------------------------------------------------------------------
// Uploads — the image rules the API enforces at the edge (upload middleware)
// and the web checks before sending, so a bad file never leaves the browser.
// The web's error copy quotes these values (`profile.avatarTooLarge` /
// `profile.avatarInvalidType` in apps/web settings.json) — update it with them.
// ------------------------------------------------------------------

/** Image types accepted for user uploads (avatar). Script-capable types (svg,
 *  html) are deliberately absent. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Largest accepted image upload (5 MB). */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
