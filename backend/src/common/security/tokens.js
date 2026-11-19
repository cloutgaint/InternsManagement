import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  dsaKeypair,
  postQuantumKeyId,
  signPostQuantumToken,
  verifyPostQuantumToken,
} from "./postQuantum.js";

const algorithm = "HS256";
const PQ_MARKER = "~PQ1~";
const optionalClaims = () => ({
  ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
  ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
});

function verificationSecrets() {
  return [
    process.env.JWT_SECRET,
    ...String(process.env.JWT_PREVIOUS_SECRETS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter(Boolean);
}

const keyId = (secret) =>
  crypto.createHash("sha256").update(secret).digest("hex").slice(0, 16);

const pqIdentity = (secret) => {
  const pair = dsaKeypair(secret, keyId(secret));
  return { ...pair, id: postQuantumKeyId(pair.publicKey) };
};

function splitHybridToken(token) {
  const marker = token.lastIndexOf(PQ_MARKER);
  if (marker < 0) return { jwt: token, pq: null };
  const jwtValue = token.slice(0, marker);
  const parts = token.slice(marker + PQ_MARKER.length).split("~");
  if (parts.length !== 2 || !jwtValue || !parts[0] || !parts[1])
    throw new Error("Malformed post-quantum token");
  return { jwt: jwtValue, pq: { keyId: parts[0], signature: parts[1] } };
}

export function signToken(payload, options = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const classic = jwt.sign(payload, secret, {
    algorithm,
    keyid: keyId(secret),
    ...optionalClaims(),
    ...options,
  });
  const pq = pqIdentity(secret);
  const signature = signPostQuantumToken(classic, pq.secretKey);
  return `${classic}${PQ_MARKER}${pq.id}~${signature.toString("base64url")}`;
}

export function verifyToken(token) {
  const hybrid = splitHybridToken(String(token || ""));
  const secrets = verificationSecrets();
  if (!secrets.length) throw new Error("JWT_SECRET is not configured");
  if (!hybrid.pq && process.env.PQ_REQUIRE_HYBRID_TOKENS === "true")
    throw new Error("A post-quantum token signature is required");
  if (hybrid.pq) {
    const identities = secrets.map(pqIdentity);
    const identity = identities.find((item) => item.id === hybrid.pq.keyId);
    if (
      !identity ||
      !verifyPostQuantumToken(
        hybrid.jwt,
        Buffer.from(hybrid.pq.signature, "base64url"),
        identity.publicKey,
      )
    )
      throw new Error("Invalid post-quantum token signature");
  }
  const decoded = jwt.decode(hybrid.jwt, { complete: true });
  const requestedKey = decoded?.header?.kid;
  const candidates = requestedKey
    ? secrets.filter((secret) => keyId(secret) === requestedKey)
    : secrets;
  let lastError;
  for (const secret of candidates) {
    try {
      return jwt.verify(hybrid.jwt, secret, {
        algorithms: [algorithm],
        ...optionalClaims(),
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Unknown JWT signing key");
}

export const JWT_ALGORITHM = algorithm;
export const TOKEN_SIGNATURE_ALGORITHM = "HS256 + ML-DSA-65";
