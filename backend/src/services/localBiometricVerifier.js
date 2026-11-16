import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const verifierDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../biometric-verifier");
let child;
let stopping = false;

/**
 * Run the local prototype verifier alongside the backend in development.
 * Production uses a separately managed HTTPS verifier and must not spawn this prototype.
 */
export function startLocalBiometricVerifier() {
  if (process.env.NODE_ENV === "production" || process.env.BIOMETRIC_AUTO_START === "false") return;
  if (child) return;
  const entry = path.join(verifierDir, "server.js");
  if (!fs.existsSync(entry)) {
    console.error("[biometric] Local verifier source missing:", entry);
    return;
  }
  if (!fs.existsSync(path.join(verifierDir, "node_modules", "@vladmandic", "human"))) {
    console.error("[biometric] Dependencies missing. Run npm install once in biometric-verifier/. Attendance verification is unavailable.");
    return;
  }
  const configuredUrl = process.env.BIOMETRIC_VERIFY_URL || "http://127.0.0.1:8765/verify";
  let url;
  try { url = new URL(configuredUrl); } catch {
    console.error("[biometric] Invalid BIOMETRIC_VERIFY_URL");
    return;
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.protocol !== "http:" || url.pathname !== "/verify") {
    console.log("[biometric] External verifier configured; automatic local startup skipped.");
    return;
  }
  if (!process.env.BIOMETRIC_VERIFY_TOKEN) {
    process.env.BIOMETRIC_VERIFY_TOKEN = crypto.randomBytes(32).toString("hex");
    console.log("[biometric] Generated a temporary local verification token for this backend session.");
  }
  const port = url.port ? Number(url.port) : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("[biometric] Invalid local verifier port");
    return;
  }
  stopping = false;
  try {
    child = spawn(process.execPath, [entry], {
      cwd: verifierDir,
      env: { ...process.env, BIOMETRIC_VERIFY_PORT: String(port) },
      stdio: ["ignore", "inherit", "inherit"],
    });
  } catch (error) {
    console.error("[biometric] Could not launch local verifier:", error.message);
    return;
  }
  const processHandle = child;
  console.log("[biometric] Starting local face verifier on 127.0.0.1:" + port + " (models may take time to load).");
  processHandle.on("error", error => {
    console.error("[biometric] Verifier startup failed:", error.message);
    if (child === processHandle) child = undefined;
  });
  processHandle.on("exit", (code, signal) => {
    if (child === processHandle) child = undefined;
    if (!stopping) console.error("[biometric] Verifier exited (" + (signal || code) + "). Attendance verification is unavailable until the backend is restarted.");
  });
}

export function stopLocalBiometricVerifier() {
  stopping = true;
  if (child && !child.killed) child.kill("SIGTERM");
}
