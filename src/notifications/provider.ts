import type { WhatsAppProvider } from "./types.ts";
import { WahaProvider, type WahaConfig } from "./waha.ts";
import { TwilioProvider, type TwilioConfig } from "./twilio.ts";

// ─── Provider Factory ──────────────────────────────────────────────────────
// Creates a WhatsAppProvider based on config. WAHA for self-hosted,
// Twilio for managed. Both implement the same interface.

export interface WhatsAppProviderConfig {
	provider: "waha" | "twilio";
	waha?: WahaConfig;
	twilio?: TwilioConfig;
}

export function createWhatsAppProvider(config: WhatsAppProviderConfig): WhatsAppProvider {
	if (config.provider === "waha") {
		if (!config.waha) {
			throw new Error("WAHA config required when provider is 'waha'");
		}
		return new WahaProvider(config.waha);
	}

	if (config.provider === "twilio") {
		if (!config.twilio) {
			throw new Error("Twilio config required when provider is 'twilio'");
		}
		return new TwilioProvider(config.twilio);
	}

	throw new Error(`Unknown WhatsApp provider: ${config.provider}`);
}
