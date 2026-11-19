import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const moduleUrl = new URL("../src/common/config/env.js", import.meta.url).href;
const validProductionEnvironment = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: "postgres://example.invalid/app",
  JWT_SECRET: "x".repeat(64),
  PQ_REQUIRE_HYBRID_TOKENS: "true",
  FRONTEND_URL: "https://interns.example.test",
  FILE_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  STORAGE_DRIVER: "s3",
  S3_BUCKET: "private-intern-files",
  S3_REGION: "ap-south-1",
  SMTP_HOST: "smtp.example.test",
  SMTP_USER: "mailer",
  SMTP_PASSWORD: "secret",
  MAIL_FROM: "interns@example.test",
  CLAMAV_HOST: "clamav.example.test",
  BIOMETRIC_VERIFY_URL: "https://biometric.example.test/verify",
  BIOMETRIC_VERIFY_TOKEN: "verifier-secret",
  INITIAL_ADMIN_EMAIL: "admin@example.test",
  INITIAL_ADMIN_PASSWORD: "unique-production-password",
  PROOF_RETENTION_DAYS: "365",
  FACE_RETENTION_DAYS: "90",
};

function validate(environment) {
  return spawnSync(process.execPath, ["--input-type=module", "--eval", `import ${JSON.stringify(moduleUrl)}`], {
    env: environment,
    encoding: "utf8",
  });
}

test("complete production configuration is accepted", () => {
  const result = validate(validProductionEnvironment);
  assert.equal(result.status, 0, result.stderr);
});

test("production refuses to start without encrypted file storage", () => {
  // Empty rather than deleted: env.js loads the root .env, and dotenv only
  // fills variables that are absent, so a deleted key would be restored.
  const result = validate({ ...validProductionEnvironment, FILE_ENCRYPTION_KEY: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FILE_ENCRYPTION_KEY is required in production/);
});

test("production requires post-quantum token verification", () => {
  const result = validate({
    ...validProductionEnvironment,
    PQ_REQUIRE_HYBRID_TOKENS: "false",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PQ_REQUIRE_HYBRID_TOKENS must be true/);
});

test("production refuses malformed encryption keys", () => {
  const result = validate({ ...validProductionEnvironment, FILE_ENCRYPTION_KEY: "!".repeat(44) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FILE_ENCRYPTION_KEY must be valid base64/);
});

test("production requires private object storage configuration", () => {
  const result = validate({ ...validProductionEnvironment, STORAGE_DRIVER: "local" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STORAGE_DRIVER must be s3 in production/);
});

test("production refuses an insecure object storage endpoint", () => {
  const result = validate({ ...validProductionEnvironment, S3_ENDPOINT: "http://objects.example.test" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /S3_ENDPOINT must use HTTPS in production/);
});

test("production refuses insecure public service URLs", () => {
  const result = validate({ ...validProductionEnvironment, BIOMETRIC_VERIFY_URL: "http://biometric.example.test/verify" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BIOMETRIC_VERIFY_URL must use HTTPS in production/);
});

test("production refuses an out-of-range anti-spoof threshold", () => {
  const result = validate({ ...validProductionEnvironment, BIOMETRIC_ANTISPOOF_THRESHOLD: "1.5" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BIOMETRIC_ANTISPOOF_THRESHOLD must be a number between 0 and 1/);
});

test("production accepts the verifier as a private Compose service over HTTP", () => {
  const result = validate({ ...validProductionEnvironment, BIOMETRIC_VERIFY_URL: "http://biometric:8765/verify" });
  assert.equal(result.status, 0, result.stderr);
});

test("production still refuses HTTP to an external or IP-addressed verifier", () => {
  for (const url of ["http://10.0.0.5:8765/verify", "http://verifier.example.test/verify"]) {
    const result = validate({ ...validProductionEnvironment, BIOMETRIC_VERIFY_URL: url });
    assert.notEqual(result.status, 0, url);
    assert.match(result.stderr, /BIOMETRIC_VERIFY_URL must use HTTPS in production/);
  }
});
