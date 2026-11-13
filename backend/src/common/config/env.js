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
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "MAIL_FROM",
    "CLAMAV_HOST",
    "BIOMETRIC_VERIFY_URL",
    "BIOMETRIC_VERIFY_TOKEN",
  ].forEach(required);

  if (Buffer.byteLength(process.env.JWT_SECRET) < 64)
    throw new Error("JWT_SECRET must be at least 64 bytes in production");

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
