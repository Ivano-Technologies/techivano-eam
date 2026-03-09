import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DATA_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;
const KEY_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENVELOPE_FORMAT_VERSION = "v1";

export type AesGcmEncryptionResult = {
  algorithm: "aes-256-gcm";
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

function parseMasterKey(raw: string): Buffer {
  const value = raw.trim();
  if (!value) {
    throw new Error("MASTER_ENCRYPTION_KEY is empty");
  }

  const hexCandidate = value.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]+$/.test(hexCandidate) && hexCandidate.length % 2 === 0) {
    const asHex = Buffer.from(hexCandidate, "hex");
    if (asHex.length === DATA_KEY_BYTES) {
      return asHex;
    }
  }

  const asBase64 = Buffer.from(value, "base64");
  if (asBase64.length === DATA_KEY_BYTES) {
    return asBase64;
  }

  throw new Error("MASTER_ENCRYPTION_KEY must be 32-byte base64 or hex");
}

function getMasterKey(): Buffer {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing required environment variable: MASTER_ENCRYPTION_KEY");
  }
  return parseMasterKey(raw);
}

function ensureDataKey(dataKey: Buffer): Buffer {
  if (!Buffer.isBuffer(dataKey) || dataKey.length !== DATA_KEY_BYTES) {
    throw new Error("dataKey must be a 32-byte Buffer");
  }
  return dataKey;
}

export function generateOrgDataKey(): Buffer {
  return randomBytes(DATA_KEY_BYTES);
}

export function encryptOrgDataKey(dataKey: Buffer): string {
  const key = ensureDataKey(dataKey);
  const masterKey = getMasterKey();
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv(KEY_ENCRYPTION_ALGORITHM, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_FORMAT_VERSION,
    KEY_ENCRYPTION_ALGORITHM,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptOrgDataKey(encrypted: string): Buffer {
  if (typeof encrypted !== "string" || !encrypted) {
    throw new Error("Encrypted data key payload is required");
  }
  const [version, algorithm, ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (version !== ENVELOPE_FORMAT_VERSION || algorithm !== KEY_ENCRYPTION_ALGORITHM) {
    throw new Error("Unsupported data key envelope format");
  }
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed data key envelope");
  }

  const masterKey = getMasterKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  if (iv.length !== GCM_IV_BYTES || authTag.length !== GCM_AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted data key envelope");
  }

  const decipher = createDecipheriv(KEY_ENCRYPTION_ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return ensureDataKey(plaintext);
}

export function encryptBufferAesGcm(plaintext: Buffer, dataKey: Buffer): AesGcmEncryptionResult {
  const key = ensureDataKey(dataKey);
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv(KEY_ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: KEY_ENCRYPTION_ALGORITHM,
    ciphertext,
    iv,
    authTag,
  };
}

export function decryptBufferAesGcm(
  ciphertext: Buffer,
  dataKey: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const key = ensureDataKey(dataKey);
  if (iv.length !== GCM_IV_BYTES || authTag.length !== GCM_AUTH_TAG_BYTES) {
    throw new Error("Invalid AES-GCM IV or auth tag");
  }

  const decipher = createDecipheriv(KEY_ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
