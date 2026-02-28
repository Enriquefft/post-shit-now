/**
 * Public API for src/platforms/
 *
 * Exports the PlatformPublisher contract, all handler classes, and the factory.
 * Internal: platform clients (XClient, etc.), media helpers, oauth functions.
 */

// --- Publish contract types (from core — co-located for single-import handlers) ---
export type {
	DbConnection,
	PlatformPublisher,
	PostRow,
	RateLimitInfo,
} from "../core/types/publisher.ts";
// --- Factory functions ---
export {
	createHandler,
	hasHandler,
	registeredPlatforms,
	registerHandler,
	unregisterHandler,
} from "../core/utils/publisher-factory.ts";
export { InstagramHandler } from "./handlers/instagram.handler.ts";
export { LinkedInHandler } from "./handlers/linkedin.handler.ts";
export { TikTokHandler } from "./handlers/tiktok.handler.ts";
// --- Handler classes (imported from individual files to avoid side-effect auto-registration barrel) ---
// NOTE: Each handler file runs registerHandler() as a top-level side-effect on import.
// Consumers who import via this barrel should be aware that handlers become registered.
export { XHandler } from "./handlers/x.handler.ts";
