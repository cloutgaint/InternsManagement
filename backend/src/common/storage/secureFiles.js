import crypto from "crypto";
import fs from "fs";
import net from "net";

// Files holding personal or biometric data are AES-256-GCM encrypted at rest (Blueprint 5.7, 19).
// Format: MAGIC | 12-byte IV | 16-byte tag | ciphertext. Files without MAGIC predate encryption.
const MAGIC = Buffer.from("GAINTENC1");

function key() {
  const raw = process.env.FILE_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Secure file storage is not configured"), { status: 503 });
    return null;
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw Object.assign(new Error("FILE_ENCRYPTION_KEY must be 32 bytes encoded as base64"), { status: 503 });
  return decoded;
}

export function sealBuffer(plain) {
  const secret = key();
  if (!secret) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function openBuffer(stored) {
  if (stored.subarray(0, MAGIC.length).compare(MAGIC) !== 0) return stored;
  const secret = key();
  if (!secret) throw Object.assign(new Error("Secure file storage is not configured"), { status: 503 });
  const iv = stored.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = stored.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(stored.subarray(MAGIC.length + 28)), decipher.final()]);
}

export const writeSecureFile = (file, plain) => fs.writeFileSync(file, sealBuffer(plain), { mode: 0o600 });
export const readSecureFile = (file) => openBuffer(fs.readFileSync(file));
export function sealFileInPlace(file) {
  writeSecureFile(file, fs.readFileSync(file));
}

export function detectFileType(data) {
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: ".pdf" };
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mime: "image/jpeg", ext: ".jpg" };
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", ext: ".png" };
  return null;
}

// ClamAV INSTREAM. Scanning is enabled by CLAMAV_HOST; once enabled an unreachable scanner rejects the upload.
export function scanBuffer(data) {
  const host = process.env.CLAMAV_HOST;
  if (!host) return Promise.resolve({ clean: true, scanned: false });
  return new Promise((resolve) => {
    const socket = net.connect(Number(process.env.CLAMAV_PORT || 3310), host);
    let reply = "";
    const fail = () => { socket.destroy(); resolve({ clean: false, scanned: false, unavailable: true }); };
    socket.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS || 30000), fail);
    socket.on("error", fail);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const size = Buffer.alloc(4);
      size.writeUInt32BE(data.length);
      socket.write(size);
      socket.write(data);
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => { reply += chunk.toString(); });
    socket.on("end", () => resolve({ clean: /:\s*OK/.test(reply), scanned: true, signature: reply.trim() }));
  });
}

// Validates content, scans, then encrypts an uploaded temp file. Throws a status error on rejection.
export async function acceptUpload(file) {
  const data = fs.readFileSync(file.path);
  const type = detectFileType(data);
  if (!type) throw Object.assign(new Error("Only PDF, JPG or PNG content is allowed"), { status: 400 });
  const scan = await scanBuffer(data);
  if (scan.unavailable) throw Object.assign(new Error("Upload scanning is unavailable. Try again shortly."), { status: 503 });
  if (!scan.clean) throw Object.assign(new Error("The uploaded file failed the malware scan"), { status: 422 });
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  sealFileInPlace(file.path);
  return { hash, mime: type.mime, ext: type.ext };
}
