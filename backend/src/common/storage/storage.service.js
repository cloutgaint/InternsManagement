import fs from "fs";
import path from "path";

export function ensureUploadDirectory(relativePath) {
  const directory = path.resolve(relativePath);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export function removeFileIfPresent(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}
