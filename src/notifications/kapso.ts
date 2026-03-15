import { $ } from "bun";
import type { MessageResult, WhatsAppProvider } from "./types.ts";

// ─── Kapso WhatsApp Provider ────────────────────────────────────────────────
// Implements WhatsAppProvider via kapso-whatsapp-cli (ZeroClaw's WhatsApp bridge).
// No config needed — the CLI reads credentials from the system.
// Buttons and lists fall back to numbered text (same as WAHA Core tier).

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

async function sendWithRetry(to: string, text: string): Promise<MessageResult> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			await $`kapso-whatsapp-cli send --to ${to} --text ${text}`.quiet();
			return { success: true };
		} catch (e) {
			if (attempt < MAX_RETRIES) {
				await Bun.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
			} else {
				return {
					success: false,
					error: `Kapso delivery failed after ${MAX_RETRIES} attempts: ${e instanceof Error ? e.message : String(e)}`,
				};
			}
		}
	}
	return { success: false, error: "Unreachable" };
}

export class KapsoProvider implements WhatsAppProvider {
	async sendText(to: string, body: string): Promise<MessageResult> {
		return sendWithRetry(to, body);
	}

	async sendButtons(
		to: string,
		body: string,
		buttons: Array<{ id: string; body: string }>,
	): Promise<MessageResult> {
		// Kapso CLI is text-only — fall back to numbered options
		const fallback = `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.body}`).join("\n")}\n\nReply with a number to choose.`;
		return sendWithRetry(to, fallback);
	}

	async sendList(
		to: string,
		body: string,
		sections: Array<{
			title: string;
			rows: Array<{ id: string; title: string; description?: string }>;
		}>,
	): Promise<MessageResult> {
		const items = sections.flatMap((s) => s.rows);
		const fallback = `${body}\n\n${items.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` - ${r.description}` : ""}`).join("\n")}\n\nReply with a number to choose.`;
		return sendWithRetry(to, fallback);
	}

	async sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult> {
		// Kapso CLI doesn't support media — send as text with URL
		const text = caption ? `${caption}\n\n${imageUrl}` : imageUrl;
		return sendWithRetry(to, text);
	}
}
