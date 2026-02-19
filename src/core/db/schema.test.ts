import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateEncryptionKey, keyFromHex } from "../utils/crypto.ts";
import { parseEnvFile } from "../utils/env.ts";
import { apiKeys, hubUser, oauthTokens, posts, users } from "./schema.ts";

describe("Schema exports", () => {
	it("exports all table definitions", () => {
		expect(users).toBeDefined();
		expect(oauthTokens).toBeDefined();
		expect(posts).toBeDefined();
		expect(apiKeys).toBeDefined();
	});

	it("exports hubUser role", () => {
		expect(hubUser).toBeDefined();
	});
});

describe("Crypto utils", () => {
	it("encrypt then decrypt returns original plaintext", () => {
		const key = generateEncryptionKey();
		const plaintext = "my-secret-oauth-token-12345";
		const ciphertext = encrypt(plaintext, key);
		const decrypted = decrypt(ciphertext, key);
		expect(decrypted).toBe(plaintext);
	});

	it("produces different ciphertext each time (random IV)", () => {
		const key = generateEncryptionKey();
		const plaintext = "same-input";
		const ct1 = encrypt(plaintext, key);
		const ct2 = encrypt(plaintext, key);
		expect(ct1).not.toBe(ct2);
	});

	it("fails to decrypt with wrong key", () => {
		const key1 = generateEncryptionKey();
		const key2 = generateEncryptionKey();
		const ciphertext = encrypt("secret", key1);
		expect(() => decrypt(ciphertext, key2)).toThrow();
	});

	it("keyFromHex validates key length", () => {
		const key = generateEncryptionKey();
		const hex = key.toString("hex");
		const restored = keyFromHex(hex);
		expect(restored).toEqual(key);
	});

	it("keyFromHex rejects invalid length", () => {
		expect(() => keyFromHex("abcd")).toThrow("32 bytes");
	});
});

describe("Env parser", () => {
	it("parses KEY=VALUE format", () => {
		const content = 'DATABASE_URL=postgres://localhost\nAPI_KEY="quoted-value"\n# comment\n';
		const result = parseEnvFile(content);
		expect(result.DATABASE_URL).toBe("postgres://localhost");
		expect(result.API_KEY).toBe("quoted-value");
	});

	it("handles empty content", () => {
		const result = parseEnvFile("");
		expect(Object.keys(result)).toHaveLength(0);
	});

	it("skips comments and blank lines", () => {
		const content = "# comment\n\n  \nKEY=value\n";
		const result = parseEnvFile(content);
		expect(Object.keys(result)).toHaveLength(1);
		expect(result.KEY).toBe("value");
	});
});
