import crypto from "crypto";
import fs from "fs";
import net from "net";
import {
  decapsulateFileKey,
  deriveFileContentKey,
  encapsulateFileKey,
  kemKeypair,
} from "../security/postQuantum.js";

// Files holding personal or biometric data use ML-KEM-768 to establish a fresh
// AES-256-GCM content key. V1/V2 remain readable during migration.
// V1: MAGIC_V1 | 12-byte IV | 16-byte tag | ciphertext
// V2: MAGIC_V2 | 1-byte key-id length | key id | 12-byte IV | 16-byte tag | ciphertext
// V3: MAGIC_V3 | key id | ML-KEM ciphertext | IV | tag | AES-GCM ciphertext
const MAGIC_V1 = Buffer.from("GAINTENC1");
const MAGIC_V2 = Buffer.from("GAINTENC2");
const MAGIC_V3 = Buffer.from("GAINTENC3");

export function encryptionEnvelopeVersion(stored) {
  if (stored.subarray(0, MAGIC_V3.length).equals(MAGIC_V3)) return 3;
  if (stored.subarray(0, MAGIC_V2.length).equals(MAGIC_V2)) return 2;
  if (stored.subarray(0, MAGIC_V1.length).equals(MAGIC_V1)) return 1;
  return 0;
}

const configurationError = (message) =>
  Object.assign(new Error(message), { status: 503 });

function decodeKey(raw, label) {
  const decoded = Buffer.from(String(raw || ""), "base64");
  if (decoded.length !== 32)
    throw configurationError(`${label} must be 32 bytes encoded as base64`);
  return decoded;
}

function keyring() {
  const raw = process.env.FILE_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production")
      throw configurationError("Secure file storage is not configured");
    return null;
  }
  const currentId = process.env.FILE_ENCRYPTION_KEY_ID || "primary";
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(currentId))
    throw configurationError("FILE_ENCRYPTION_KEY_ID is invalid");
  const keys = new Map([[currentId, decodeKey(raw, "FILE_ENCRYPTION_KEY")]]);
  if (process.env.FILE_ENCRYPTION_PREVIOUS_KEYS) {
    let previous;
    try { previous = JSON.parse(process.env.FILE_ENCRYPTION_PREVIOUS_KEYS); }
    catch { throw configurationError("FILE_ENCRYPTION_PREVIOUS_KEYS must be a JSON object"); }
    if (!previous || Array.isArray(previous) || typeof previous !== "object")
      throw configurationError("FILE_ENCRYPTION_PREVIOUS_KEYS must be a JSON object");
    for (const [id, value] of Object.entries(previous)) {
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(id) || keys.has(id))
        throw configurationError("FILE_ENCRYPTION_PREVIOUS_KEYS contains an invalid or duplicate key id");
      keys.set(id, decodeKey(value, `Previous encryption key ${id}`));
    }
  }
  return { currentId, keys };
}

function decrypt(body, secret, iv, tag) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

export function sealBuffer(plain) {
  const ring = keyring();
  if (!ring) return plain;
  const secret = ring.keys.get(ring.currentId);
  const kem = kemKeypair(secret, ring.currentId);
  const encapsulated = encapsulateFileKey(kem.publicKey);
  const contentKey = deriveFileContentKey(
    encapsulated.sharedSecret,
    encapsulated.cipherText,
  );
  const iv = crypto.randomBytes(12);
  const id = Buffer.from(ring.currentId, "utf8");
  const kemLength = Buffer.alloc(2);
  kemLength.writeUInt16BE(encapsulated.cipherText.length);
  const header = Buffer.concat([
    MAGIC_V3,
    Buffer.from([id.length]),
    id,
    kemLength,
    encapsulated.cipherText,
  ]);
  const cipher = crypto.createCipheriv("aes-256-gcm", contentKey, iv);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, iv, cipher.getAuthTag(), body]);
}

export function openBuffer(stored) {
  const isV1 = stored.subarray(0, MAGIC_V1.length).equals(MAGIC_V1);
  const isV2 = stored.subarray(0, MAGIC_V2.length).equals(MAGIC_V2);
  const isV3 = stored.subarray(0, MAGIC_V3.length).equals(MAGIC_V3);
  if (!isV1 && !isV2 && !isV3) return stored;
  const ring = keyring();
  if (!ring) throw configurationError("Secure file storage is not configured");
  if (isV3) {
    const idLength = stored[MAGIC_V3.length];
    const idStart = MAGIC_V3.length + 1;
    const kemLengthStart = idStart + idLength;
    if (!idLength || stored.length < kemLengthStart + 2)
      throw configurationError("Post-quantum encrypted file header is invalid");
    const id = stored.subarray(idStart, kemLengthStart).toString("utf8");
    const secret = ring.keys.get(id);
    if (!secret) throw configurationError(`Encryption key ${id} is unavailable`);
    const kemLength = stored.readUInt16BE(kemLengthStart);
    const kemStart = kemLengthStart + 2;
    const ivStart = kemStart + kemLength;
    if (!kemLength || stored.length < ivStart + 28)
      throw configurationError("Post-quantum encrypted file header is invalid");
    const cipherText = stored.subarray(kemStart, ivStart);
    const kem = kemKeypair(secret, id);
    const sharedSecret = decapsulateFileKey(cipherText, kem.secretKey);
    const contentKey = deriveFileContentKey(sharedSecret, cipherText);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      contentKey,
      stored.subarray(ivStart, ivStart + 12),
    );
    decipher.setAAD(stored.subarray(0, ivStart));
    decipher.setAuthTag(stored.subarray(ivStart + 12, ivStart + 28));
    return Buffer.concat([
      decipher.update(stored.subarray(ivStart + 28)),
      decipher.final(),
    ]);
  }
  if (isV2) {
    const idLength = stored[MAGIC_V2.length];
    const idStart = MAGIC_V2.length + 1, ivStart = idStart + idLength;
    if (!idLength || stored.length < ivStart + 28)
      throw configurationError("Encrypted file header is invalid");
    const id = stored.subarray(idStart, ivStart).toString("utf8");
    const secret = ring.keys.get(id);
    if (!secret) throw configurationError(`Encryption key ${id} is unavailable`);
    return decrypt(
      stored.subarray(ivStart + 28), secret,
      stored.subarray(ivStart, ivStart + 12),
      stored.subarray(ivStart + 12, ivStart + 28),
    );
  }
  const iv = stored.subarray(MAGIC_V1.length, MAGIC_V1.length + 12);
  const tag = stored.subarray(MAGIC_V1.length + 12, MAGIC_V1.length + 28);
  const body = stored.subarray(MAGIC_V1.length + 28);
  for (const secret of ring.keys.values()) {
    try { return decrypt(body, secret, iv, tag); } catch {}
  }
  throw configurationError("No configured encryption key can decrypt this legacy file");
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
  const hash = crypto.createHash("sha512").update(data).digest("hex");
  const legacyHash = crypto.createHash("sha256").update(data).digest("hex");
  sealFileInPlace(file.path);
  return { hash, legacyHash, mime: type.mime, ext: type.ext };
}
