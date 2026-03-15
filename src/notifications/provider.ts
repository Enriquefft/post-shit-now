import { KapsoProvider } from "./kapso.ts";
import { type TwilioConfig, TwilioProvider } from "./twilio.ts";
import type { WhatsAppProvider } from "./types.ts";
import { type WahaConfig, WahaProvider } from "./waha.ts";

// ─── Provider Factory ──────────────────────────────────────────────────────
// Creates a WhatsAppProvider based on config. WAHA for self-hosted,
// Twilio for managed, Kapso for ZeroClaw bridge. All implement the same interface.

export interface WhatsAppProviderConfig {
	provider: "waha" | "twilio" | "kapso";
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

	if (config.provider === "kapso") {
		return new KapsoProvider();
	}

	throw new Error(`Unknown WhatsApp provider: ${config.provider}`);
}
