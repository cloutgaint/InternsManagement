import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { openBuffer, sealBuffer } from "./secureFiles.js";

const localRoot = () => path.resolve(process.env.UPLOAD_ROOT || "uploads");
const driver = () => String(process.env.STORAGE_DRIVER || "local").toLowerCase();
let cachedClient;
let cachedConfig;

function s3Client() {
  const config = { region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" };
  const signature = JSON.stringify(config);
  if (!cachedClient || signature !== cachedConfig) {
    cachedClient = new S3Client(config);
    cachedConfig = signature;
  }
  return cachedClient;
}

function bucket() {
  const value = process.env.S3_BUCKET?.trim();
  if (!value) throw Object.assign(new Error("S3_BUCKET is not configured"), { status: 503 });
  return value;
}

const cleanSegment = (value) => String(value || "files").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "files";

function objectKey(prefix, filename) {
  const extension = path.extname(filename || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${String(prefix || "files").split("/").map(cleanSegment).join("/")}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
}

export const isS3Reference = (reference) => typeof reference === "string" && reference.startsWith("s3://");

function parseS3Reference(reference) {
  const parsed = new URL(reference);
  return { Bucket: parsed.hostname, Key: decodeURIComponent(parsed.pathname.slice(1)) };
}

export function ensureUploadDirectory(relativePath) {
  const directory = path.resolve(relativePath);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export async function writeStoredBuffer(buffer, { prefix = "files", filename, contentType } = {}) {
  if (driver() === "s3") {
    const Bucket = bucket();
    const Key = objectKey(prefix, filename);
    const encryption = process.env.S3_KMS_KEY_ID
      ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: process.env.S3_KMS_KEY_ID }
      : { ServerSideEncryption: "AES256" };
    await s3Client().send(new PutObjectCommand({ Bucket, Key, Body: buffer, ContentType: contentType, ...encryption }));
    return `s3://${Bucket}/${Key}`;
  }
  const directory = path.join(localRoot(), ...String(prefix).split("/").map(cleanSegment));
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${crypto.randomUUID()}${path.extname(filename || "").toLowerCase()}`);
  await fs.promises.writeFile(target, buffer, { mode: 0o600 });
  return target;
}

export async function persistUploadedFile(file, options = {}) {
  const bytes = await fs.promises.readFile(file.path);
  const reference = await writeStoredBuffer(bytes, { filename: file.originalname || file.path, contentType: file.mimetype, ...options });
  if (!isS3Reference(reference) && path.resolve(reference) === path.resolve(file.path)) return reference;
  await fs.promises.unlink(file.path).catch((error) => { if (error.code !== "ENOENT") throw error; });
  return reference;
}

export async function persistSecureUploadedFile(file, options = {}) {
  const bytes = sealBuffer(await fs.promises.readFile(file.path));
  const reference = await writeStoredBuffer(bytes, { filename: file.originalname || file.path, contentType: "application/octet-stream", ...options });
  await fs.promises.unlink(file.path).catch((error) => { if (error.code !== "ENOENT") throw error; });
  return reference;
}

export const writeSecureStoredBuffer = (buffer, options = {}) => writeStoredBuffer(sealBuffer(buffer), { ...options, contentType: "application/octet-stream" });

export async function readStoredBuffer(reference) {
  if (!reference) throw Object.assign(new Error("Stored file is unavailable"), { status: 404 });
  if (isS3Reference(reference)) {
    const result = await s3Client().send(new GetObjectCommand(parseS3Reference(reference)));
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return fs.promises.readFile(path.resolve(reference));
}

export async function replaceStoredBuffer(reference, buffer) {
  if (!reference) throw Object.assign(new Error("Stored file is unavailable"), { status: 404 });
  if (isS3Reference(reference)) {
    const location = parseS3Reference(reference);
    const encryption = process.env.S3_KMS_KEY_ID
      ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: process.env.S3_KMS_KEY_ID }
      : { ServerSideEncryption: "AES256" };
    await s3Client().send(new PutObjectCommand({
      ...location,
      Body: buffer,
      ContentType: "application/octet-stream",
      ...encryption,
    }));
    return;
  }
  const target = path.resolve(reference);
  const temporary = `${target}.pq-${crypto.randomUUID()}.tmp`;
  await fs.promises.writeFile(temporary, buffer, { mode: 0o600 });
  try {
    await fs.promises.rename(temporary, target);
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function readSecureStoredBuffer(reference) {
  return openBuffer(await readStoredBuffer(reference));
}

export async function storedObjectExists(reference) {
  if (!reference) return false;
  try {
    if (isS3Reference(reference)) await s3Client().send(new HeadObjectCommand(parseS3Reference(reference)));
    else await fs.promises.access(path.resolve(reference), fs.constants.R_OK);
    return true;
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404 || error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function removeStoredObject(reference) {
  if (!reference) return;
  if (isS3Reference(reference)) {
    await s3Client().send(new DeleteObjectCommand(parseS3Reference(reference)));
    return;
  }
  await fs.promises.unlink(path.resolve(reference)).catch((error) => { if (error.code !== "ENOENT") throw error; });
}

export function removeFileIfPresent(reference) {
  void removeStoredObject(reference).catch(() => {});
}
