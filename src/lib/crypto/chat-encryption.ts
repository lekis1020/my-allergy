import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:";

function getMasterKey(): Buffer {
  const key = process.env.CHAT_ENCRYPTION_KEY;
  if (!key) throw new Error("CHAT_ENCRYPTION_KEY is not set");
  return Buffer.from(key, "hex");
}

/** Derive a per-user key from the master key + user ID */
function deriveUserKey(userId: string): Buffer {
  const master = getMasterKey();
  return createHmac("sha256", master).update(userId).digest();
}

/** Encrypt a JSON-serializable value. Returns a prefixed string. */
export function encryptChatData(data: unknown, userId: string): string {
  const key = deriveUserKey(userId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: enc:<iv>:<authTag>:<ciphertext> (all base64)
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypt a prefixed string back to parsed JSON. */
export function decryptChatData<T = unknown>(encrypted: string, userId: string): T {
  const key = deriveUserKey(userId);
  const parts = encrypted.slice(ENCRYPTED_PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

/** Check if a value is encrypted (has the prefix). */
export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Safely read chat messages — handles both encrypted and legacy plaintext.
 * Returns parsed ChatMessage array.
 */
export function readChatMessages<T = unknown>(stored: unknown, userId: string): T[] {
  if (!stored) return [];

  // New format: encrypted string
  if (isEncrypted(stored)) {
    return decryptChatData<T[]>(stored as string, userId);
  }

  // Legacy format: plain JSON array (migrate on next write)
  if (Array.isArray(stored)) {
    return stored as T[];
  }

  return [];
}
