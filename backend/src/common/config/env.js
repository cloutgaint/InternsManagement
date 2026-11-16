import dotenv from "dotenv";

dotenv.config({ path: new URL("../../../../.env", import.meta.url) });

const required = (name) => {
  if (!process.env[name]?.trim())
    throw new Error(`${name} is required in production`);
};

function positiveInteger(name) {
  required(name);
  if (!/^\d+$/.test(process.env[name]) || Number(process.env[name]) < 1)
    throw new Error(`${name} must be a positive integer`);
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  [
    "DATABASE_URL",
    "JWT_SECRET",
    "FRONTEND_URL",
    "FILE_ENCRYPTION_KEY",
    "STORAGE_DRIVER",
    "S3_BUCKET",
    "S3_REGION",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "MAIL_FROM",
    "CLAMAV_HOST",
    "BIOMETRIC_VERIFY_URL",
    "BIOMETRIC_VERIFY_TOKEN",
    "INITIAL_ADMIN_EMAIL",
    "INITIAL_ADMIN_PASSWORD",
  ].forEach(required);

  if (process.env.STORAGE_DRIVER !== "s3")
    throw new Error("STORAGE_DRIVER must be s3 in production");
  if (process.env.S3_ENDPOINT) {
    let endpoint;
    try { endpoint = new URL(process.env.S3_ENDPOINT); }
    catch { throw new Error("S3_ENDPOINT must be an absolute URL"); }
    if (endpoint.protocol !== "https:") throw new Error("S3_ENDPOINT must use HTTPS in production");
  }

  if (Buffer.byteLength(process.env.JWT_SECRET) < 64)
    throw new Error("JWT_SECRET must be at least 64 bytes in production");

  if (!/^\S+@\S+\.\S+$/.test(process.env.INITIAL_ADMIN_EMAIL))
    throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address");
  if (
    process.env.INITIAL_ADMIN_PASSWORD.length < 12 ||
    process.env.INITIAL_ADMIN_PASSWORD === "ChangeMe123!"
  )
    throw new Error(
      "INITIAL_ADMIN_PASSWORD must be at least 12 characters and must not use the development default",
    );

  if (!/^[A-Za-z0-9+/]{43}=$/.test(process.env.FILE_ENCRYPTION_KEY))
    throw new Error("FILE_ENCRYPTION_KEY must be valid base64");
  const encryptionKey = Buffer.from(process.env.FILE_ENCRYPTION_KEY, "base64");
  if (encryptionKey.length !== 32)
    throw new Error(
      "FILE_ENCRYPTION_KEY must contain exactly 32 bytes encoded as base64",
    );

  for (const name of ["FRONTEND_URL", "BIOMETRIC_VERIFY_URL"]) {
    let url;
    try {
      url = new URL(process.env[name]);
    } catch {
      throw new Error(`${name} must be an absolute URL`);
    }
    if (url.protocol !== "https:")
      throw new Error(`${name} must use HTTPS in production`);
  }

  positiveInteger("PROOF_RETENTION_DAYS");
  positiveInteger("FACE_RETENTION_DAYS");
}

validateProductionEnvironment();
