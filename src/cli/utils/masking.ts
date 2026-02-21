/**
 * Sensitive data masking utilities for error messages.
 * Masks database URLs and API keys while preserving debugging capability.
 */

/**
 * Mask database URL by hiding username, password, and hostname.
 * Preserves protocol, port, and database name for debugging.
 * Format: postgres://***@***:5432/dbname
 *
 * @param url - Database connection string to mask
 * @returns Masked URL string or "***masked***" if parsing fails
 */
export function maskDatabaseUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.username = "***";
		parsed.password = "***";
		parsed.hostname = "***";
		return parsed.toString();
	} catch {
		return "***masked***";
	}
}

/**
 * Mask API key by showing prefix (first 3 chars) + asterisks + suffix (last 3 chars).
 * Format: tr_***xyz
 *
 * @param key - API key to mask
 * @returns Masked key string or "***" for keys shorter than 6 characters
 */
export function maskApiKey(key: string): string {
	if (!key || key.length < 6) return "***";

	const prefixLength = 3;
	const suffixLength = 3;

	if (key.length <= prefixLength + suffixLength) {
		return "***";
	}

	return `${key.slice(0, prefixLength)}${"*".repeat(key.length - prefixLength - suffixLength)}${key.slice(-suffixLength)}`;
}

/**
 * Format error message by masking sensitive data in context.
 * Replaces database URLs and API keys in the message with their masked versions.
 *
 * @param message - Original error message
 * @param context - Object containing sensitive data to mask
 * @returns Formatted message with sensitive data masked
 */
export function formatErrorWithMasking(
	message: string,
	context?: { databaseUrl?: string; apiKey?: string; [key: string]: string | number | boolean | null },
): string {
	let formatted = message;

	if (!context) return formatted;

	// Mask database URLs in message
	if (context.databaseUrl) {
		const masked = maskDatabaseUrl(context.databaseUrl);
		formatted = formatted.replace(context.databaseUrl, masked);
	}

	// Mask API keys in message
	if (context.apiKey) {
		const masked = maskApiKey(context.apiKey);
		formatted = formatted.replace(context.apiKey, masked);
	}

	return formatted;
}
