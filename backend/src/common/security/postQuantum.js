import crypto from "node:crypto";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

const KDF_SALT = Buffer.from("KavachQ post-quantum key derivation v1", "utf8");
const TOKEN_CONTEXT = Buffer.from("KavachQ authentication token v1", "utf8");
const cache = new Map();

const bytes = (value) =>
  Buffer.isBuffer(value) ? value : Buffer.from(String(value || ""), "utf8");

function derive(secret, purpose, length) {
  return Buffer.from(
    crypto.hkdfSync(
      "sha512",
      bytes(secret),
      KDF_SALT,
      Buffer.from(purpose, "utf8"),
      length,
    ),
  );
}

function cachedKeypair(type, secret, keyId) {
  const fingerprint = crypto
    .createHash("sha512")
    .update(bytes(secret))
    .update("\0")
    .update(keyId)
    .digest("hex");
  const cacheKey = `${type}:${fingerprint}`;
  if (!cache.has(cacheKey)) {
    const pair =
      type === "kem"
        ? ml_kem768.keygen(derive(secret, `ML-KEM-768:${keyId}`, 64))
        : ml_dsa65.keygen(derive(secret, `ML-DSA-65:${keyId}`, 32));
    cache.set(cacheKey, pair);
  }
  return cache.get(cacheKey);
}

export const kemKeypair = (secret, keyId) =>
  cachedKeypair("kem", secret, keyId);

export const dsaKeypair = (secret, keyId) =>
  cachedKeypair("dsa", secret, keyId);

export function postQuantumKeyId(publicKey) {
  return crypto
    .createHash("sha512")
    .update(publicKey)
    .digest("base64url")
    .slice(0, 22);
}

export function encapsulateFileKey(publicKey) {
  const result = ml_kem768.encapsulate(publicKey);
  return {
    cipherText: Buffer.from(result.cipherText),
    sharedSecret: Buffer.from(result.sharedSecret),
  };
}

export const decapsulateFileKey = (cipherText, secretKey) =>
  Buffer.from(ml_kem768.decapsulate(cipherText, secretKey));

export function deriveFileContentKey(sharedSecret, cipherText) {
  return Buffer.from(
    crypto.hkdfSync(
      "sha512",
      sharedSecret,
      crypto.createHash("sha512").update(cipherText).digest(),
      Buffer.from("KavachQ ML-KEM-768 + AES-256-GCM file v3", "utf8"),
      32,
    ),
  );
}

const tokenMessage = (jwt) =>
  Buffer.concat([TOKEN_CONTEXT, Buffer.from([0]), Buffer.from(jwt, "utf8")]);

export const signPostQuantumToken = (jwt, secretKey) =>
  Buffer.from(
    ml_dsa65.sign(tokenMessage(jwt), secretKey, { context: TOKEN_CONTEXT }),
  );

export const verifyPostQuantumToken = (jwt, signature, publicKey) =>
  ml_dsa65.verify(signature, tokenMessage(jwt), publicKey, {
    context: TOKEN_CONTEXT,
  });

export const POST_QUANTUM_ALGORITHMS = Object.freeze({
  kem: "ML-KEM-768",
  signature: "ML-DSA-65",
  fileCipher: "AES-256-GCM",
  kdf: "HKDF-SHA-512",
});
