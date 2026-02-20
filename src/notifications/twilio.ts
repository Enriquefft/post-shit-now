import { z } from "zod/v4";
import type { MessageResult, WhatsAppProvider } from "./types.ts";

// ─── Twilio WhatsApp API Client ────────────────────────────────────────────
// Implements WhatsAppProvider via Twilio's Messages API.
// Buttons/lists fall back to numbered text (Twilio requires pre-registered
// Content Templates for interactive messages).

const TwilioResponseSchema = z.object({ sid: z.string().optional() });

export interface TwilioConfig {
	accountSid: string;
	authToken: string;
	fromNumber: string; // E.164 without + prefix (e.g., "14155238886")
}

export class TwilioProvider implements WhatsAppProvider {
	private baseUrl: string;
	private authHeader: string;
	private fromNumber: string;

	constructor(config: TwilioConfig) {
		this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
		this.authHeader = `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`;
		this.fromNumber = config.fromNumber;
	}

	private formatTo(phone: string): string {
		const digits = phone.replace(/\D/g, "");
		return `whatsapp:+${digits}`;
	}

	private formatFrom(): string {
		return `whatsapp:+${this.fromNumber}`;
	}

	async sendText(to: string, body: string): Promise<MessageResult> {
		try {
			const params = new URLSearchParams({
				To: this.formatTo(to),
				From: this.formatFrom(),
				Body: body,
			});

			const res = await fetch(this.baseUrl, {
				method: "POST",
				headers: {
					Authorization: this.authHeader,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: params.toString(),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				return { success: false, error: `Twilio sendText failed (${res.status}): ${text}` };
			}

			const data = TwilioResponseSchema.parse(await res.json());
			return { success: true, messageId: data.sid };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async sendButtons(
		to: string,
		body: string,
		buttons: Array<{ id: string; body: string }>,
	): Promise<MessageResult> {
		// Twilio requires pre-registered Content Templates for interactive buttons.
		// Fall back to numbered text options for flexibility.
		const fallbackBody = `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.body}`).join("\n")}\n\nReply with a number to choose.`;
		return this.sendText(to, fallbackBody);
	}

	async sendList(
		to: string,
		body: string,
		sections: Array<{
			title: string;
			rows: Array<{ id: string; title: string; description?: string }>;
		}>,
	): Promise<MessageResult> {
		// Twilio requires Content Templates for list messages.
		// Fall back to formatted text.
		const items = sections.flatMap((s) => s.rows);
		const fallbackBody = `${body}\n\n${items.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` - ${r.description}` : ""}`).join("\n")}\n\nReply with a number to choose.`;
		return this.sendText(to, fallbackBody);
	}

	async sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult> {
		try {
			const params = new URLSearchParams({
				To: this.formatTo(to),
				From: this.formatFrom(),
				MediaUrl: imageUrl,
			});
			if (caption) {
				params.set("Body", caption);
			}

			const res = await fetch(this.baseUrl, {
				method: "POST",
				headers: {
					Authorization: this.authHeader,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: params.toString(),
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				return { success: false, error: `Twilio sendImage failed (${res.status}): ${text}` };
			}

			const data = TwilioResponseSchema.parse(await res.json());
			return { success: true, messageId: data.sid };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : String(error) };
		}
	}
}
