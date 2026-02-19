import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string: IV (12) + AuthTag (16) + Ciphertext
 */
export function encrypt(plaintext: string, key: Buffer): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt base64-encoded ciphertext using AES-256-GCM.
 * Expects format: IV (12) + AuthTag (16) + Ciphertext
 */
export function decrypt(ciphertext: string, key: Buffer): string {
	const data = Buffer.from(ciphertext, "base64");
	const iv = data.subarray(0, IV_LENGTH);
	const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
	const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);
	return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

/**
 * Generate a random 32-byte encryption key for AES-256.
 */
export function generateEncryptionKey(): Buffer {
	return randomBytes(32);
}

/**
 * Derive encryption key from the HUB_ENCRYPTION_KEY env var in hub.env.
 * The key is stored as a hex string.
 */
export function keyFromHex(hexKey: string): Buffer {
	const buf = Buffer.from(hexKey, "hex");
	if (buf.length !== 32) {
		throw new Error(`Encryption key must be 32 bytes (64 hex chars), got ${buf.length} bytes`);
	}
	return buf;
}
