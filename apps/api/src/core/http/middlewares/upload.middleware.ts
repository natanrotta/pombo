import multer from "multer";
import { RequestHandler } from "express";
import { MAX_IMAGE_UPLOAD_BYTES } from "@pombo/shared-types";
import { BadRequestError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { isAllowedImageMimeType } from "@shared/constant/image-upload";

const storage = multer.memoryStorage();

// `file.mimetype` is the client-declared multipart header — TRUSTED once it is
// on the allowlist, never VERIFIED against the bytes (no magic-number sniff
// anywhere in the chain). The allowlist excludes every type that can carry
// script (svg, html), so a lie here — SVG bytes declared `image/png` — is
// stored as `.png` with `ContentType: image/png` and renders as a broken
// image, not as SVG, for as long as the avatar origin never sniffs content
// (`X-Content-Type-Options: nosniff` on the bucket/CDN is the belt to this
// suspender). The use case derives the stored extension + ContentType from
// this allowlisted value, never from the filename (SEC-H6).
const imageFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (isAllowedImageMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        "Invalid image file type",
        undefined,
        ErrorCodes.FILE_INVALID_TYPE,
      ),
    );
  }
};

// Single-image upload — used by the avatar endpoint. `memoryStorage` buffers
// the whole file in RAM, so the size ceiling (`MAX_IMAGE_UPLOAD_BYTES`)
// doubles as a memory guard.
export const uploadImage: RequestHandler = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
}).single("file") as unknown as RequestHandler;
