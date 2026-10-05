import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.resolve("uploads/registration");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(
    null,
    `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
  ),
});

export const registrationUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, callback) =>
    ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype)
      ? callback(null, true)
      : callback(Object.assign(
          new Error("Only PDF, JPG and PNG files are allowed"),
          { status: 400 },
        )),
});

export const uploadedRegistrationFiles = (files) => [
  ...(files?.proofFiles || []),
  ...(files?.photo || []),
];

export function removeUploadedFiles(files) {
  files.forEach((file) => fs.unlink(file.path, () => {}));
}
