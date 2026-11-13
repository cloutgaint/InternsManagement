import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const moduleUrl = new URL("../src/common/config/env.js", import.meta.url).href;
const validProductionEnvironment = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_URL: "postgres://example.invalid/app",
  JWT_SECRET: "x".repeat(64),
  FRONTEND_URL: "https://interns.example.test",
  FILE_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  SMTP_HOST: "smtp.example.test",
  SMTP_USER: "mailer",
  SMTP_PASSWORD: "secret",
  MAIL_FROM: "interns@example.test",
  CLAMAV_HOST: "clamav.example.test",
  BIOMETRIC_VERIFY_URL: "https://biometric.example.test/verify",
  BIOMETRIC_VERIFY_TOKEN: "verifier-secret",
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
  const environment = { ...validProductionEnvironment };
  delete environment.FILE_ENCRYPTION_KEY;
  const result = validate(environment);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FILE_ENCRYPTION_KEY is required in production/);
});

test("production refuses malformed encryption keys", () => {
  const result = validate({ ...validProductionEnvironment, FILE_ENCRYPTION_KEY: "!".repeat(44) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FILE_ENCRYPTION_KEY must be valid base64/);
});

test("production refuses insecure public service URLs", () => {
  const result = validate({ ...validProductionEnvironment, BIOMETRIC_VERIFY_URL: "http://biometric.example.test/verify" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BIOMETRIC_VERIFY_URL must use HTTPS in production/);
});
