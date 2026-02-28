import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 12;

/**
 * Generate a nanoid-style ID using Node.js crypto.
 * Shorter than UUID, URL-friendly, cryptographically secure.
 * Collision probability at 12 chars: ~1 in 3.2e21 (statistically impossible)
 *
 * @param size - Length of ID to generate (default: 12)
 * @returns URL-friendly random string
 */
export function nanoid(size = DEFAULT_LENGTH): string {
	const bytes = randomBytes(size);
	let result = "";

	for (let i = 0; i < size; i++) {
		result += ALPHABET[(bytes[i] ?? 0) & 63];
	}

	return result;
}
