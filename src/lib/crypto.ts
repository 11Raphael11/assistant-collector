import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { env } from "./env";
import { err, ok, type Result } from "./result";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

function getBlindIndexKey(): Buffer {
  return Buffer.from(env.BLIND_INDEX_KEY, "hex");
}

export function encryptPII(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptPII(token: string): Result<string> {
  if (typeof token !== "string" || token.length === 0) {
    return err("DECRYPT_FAILED", "invalid token");
  }
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    return err("DECRYPT_FAILED", "malformed token");
  }
  const [, ivB64, tagB64, cipherB64] = parts;
  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    tag = Buffer.from(tagB64, "base64");
    ciphertext = Buffer.from(cipherB64, "base64");
  } catch {
    return err("DECRYPT_FAILED", "base64 decode failed");
  }
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    return err("DECRYPT_FAILED", "invalid iv or tag length");
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return ok(plaintext.toString("utf8"));
  } catch (e) {
    return err("DECRYPT_FAILED", "auth tag verification failed", e);
  }
}

// Deterministic HMAC-SHA256 over the (already-normalized) value, keyed by
// BLIND_INDEX_KEY. Returned as lowercase hex so it can back a UNIQUE index
// and equality search. NOTE: this is intentionally deterministic — unlike
// encryptPII which is non-deterministic (random IV). Determinism enables
// uniqueness/search; encryption uses a separate key to avoid leaking the
// index key when ciphertexts are exposed.
export function blindIndex(value: string): string {
  return createHmac("sha256", getBlindIndexKey()).update(value, "utf8").digest("hex");
}

// Returns the final 4 characters of the value for display/user search.
// Safe on inputs shorter than 4 characters: returns whatever is available
// (including empty string for empty input) — never throws.
export function last4(value: string): string {
  if (value.length <= 4) return value;
  return value.slice(-4);
}
