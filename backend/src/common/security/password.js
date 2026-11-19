import argon2 from "argon2";
import bcrypt from "bcryptjs";

// New credentials use Argon2id. Existing bcrypt hashes remain valid and are
// upgraded after the next successful credential check.
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
});

export const hashPassword = (password) =>
  argon2.hash(String(password), ARGON2_OPTIONS);

export async function verifyPassword(password, encodedHash) {
  const hash = String(encodedHash || "");
  try {
    if (hash.startsWith("$argon2")) {
      const valid = await argon2.verify(hash, String(password));
      return {
        valid,
        needsRehash: valid && argon2.needsRehash(hash, ARGON2_OPTIONS),
      };
    }
    if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
      const valid = await bcrypt.compare(String(password), hash);
      return { valid, needsRehash: valid };
    }
  } catch {
    // Malformed or unsupported hashes are authentication failures.
  }
  return { valid: false, needsRehash: false };
}

export async function upgradePasswordHash(run, userId, password, verification) {
  if (!verification?.valid || !verification.needsRehash) return false;
  await run(
    "UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2",
    [await hashPassword(password), userId],
  );
  return true;
}

export { ARGON2_OPTIONS };
