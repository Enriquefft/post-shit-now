import { z } from "zod/v4";
import type { MessageResult, WhatsAppProvider } from "./types.ts";

// ─── WAHA REST API Client ──────────────────────────────────────────────────
// Implements WhatsAppProvider via WAHA (WhatsApp HTTP API).
// Supports both WAHA Core (text only) and WAHA Plus (buttons, lists).
// Core tier fallback: buttons/lists render as numbered text options.

const WahaResponseSchema = z.object({ id: z.string().optional() });

export interface WahaConfig {
	baseUrl: string;
	session?: string;
	apiKey?: string;
}

function formatChatId(phone: string): string {
	// Strip any non-digit characters, then append @c.us
	const digits = phone.replace(/\D/g, "");
	return `${digits}@c.us`;
}

export class WahaProvider implements WhatsAppProvider {
	private baseUrl: string;
	private session: string;
	private apiKey?: string;

	constructor(config: WahaConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, ""); // strip trailing slash
		this.session = config.session ?? "default";
		this.apiKey = config.apiKey;
	}

	private headers(): Record<string, string> {
		const h: Record<string, string> = { "Content-Type": "application/json" };
		if (this.apiKey) {
			h["X-Api-Key"] = this.apiKey;
		}
		return h;
	}

	async sendText(to: string, body: string): Promise<MessageResult> {
		try {
			const res = await fetch(`${this.baseUrl}/api/sendText`, {
				method: "POST",
				headers: this.headers(),
				body: JSON.stringify({
					session: this.session,
					chatId: formatChatId(to),
					text: body,
				}),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				return { success: false, error: `WAHA sendText failed (${res.status}): ${text}` };
			}

			const data = WahaResponseSchema.parse(await res.json());
			return { success: true, messageId: data.id };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async sendButtons(
		to: string,
		body: string,
		buttons: Array<{ id: string; body: string }>,
	): Promise<MessageResult> {
		try {
			// Try WAHA Plus buttons endpoint
			const res = await fetch(`${this.baseUrl}/api/send/buttons/reply`, {
				method: "POST",
				headers: this.headers(),
				body: JSON.stringify({
					session: this.session,
					chatId: formatChatId(to),
					body,
					buttons: buttons.map((b) => ({ id: b.id, body: b.body })),
				}),
			});

			// Fallback for WAHA Core (no button support)
			if (res.status >= 400 && res.status < 500) {
				const fallbackBody = `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.body}`).join("\n")}\n\nReply with a number to choose.`;
				return this.sendText(to, fallbackBody);
			}

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				return { success: false, error: `WAHA sendButtons failed (${res.status}): ${text}` };
			}

			const data = WahaResponseSchema.parse(await res.json());
			return { success: true, messageId: data.id };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async sendList(
		to: string,
		body: string,
		sections: Array<{
			title: string;
			rows: Array<{ id: string; title: string; description?: string }>;
		}>,
	): Promise<MessageResult> {
		try {
			const res = await fetch(`${this.baseUrl}/api/sendList`, {
				method: "POST",
				headers: this.headers(),
				body: JSON.stringify({
					session: this.session,
					chatId: formatChatId(to),
					body,
					title: "Options",
					sections,
				}),
			});

			// Fallback for WAHA Core (no list support)
			if (res.status >= 400 && res.status < 500) {
				const items = sections.flatMap((s) => s.rows);
				const fallbackBody = `${body}\n\n${items.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` - ${r.description}` : ""}`).join("\n")}\n\nReply with a number to choose.`;
				return this.sendText(to, fallbackBody);
			}

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				return { success: false, error: `WAHA sendList failed (${res.status}): ${text}` };
			}

			const data = WahaResponseSchema.parse(await res.json());
			return { success: true, messageId: data.id };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult> {
		try {
			const res = await fetch(`${this.baseUrl}/api/sendImage`, {
				method: "POST",
				headers: this.headers(),
				body: JSON.stringify({
					session: this.session,
					chatId: formatChatId(to),
					file: { url: imageUrl },
					caption: caption ?? "",
				}),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				return { success: false, error: `WAHA sendImage failed (${res.status}): ${text}` };
			}

			const data = WahaResponseSchema.parse(await res.json());
			return { success: true, messageId: data.id };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}
}
