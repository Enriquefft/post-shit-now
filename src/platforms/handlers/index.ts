/**
 * Platform handler barrel exports.
 *
 * Importing this module auto-registers all handlers with the factory via
 * side-effect imports. Each handler calls registerHandler() at module
 * initialisation time, making the factory pattern work without circular deps.
 *
 * Usage in orchestrator:
 *   import "../platforms/handlers/index.ts"; // registers all handlers
 *   const handler = createHandler("x");
 */
export { XHandler } from "./x.handler.ts";
export { LinkedInHandler } from "./linkedin.handler.ts";
export { InstagramHandler } from "./instagram.handler.ts";
export { TikTokHandler } from "./tiktok.handler.ts";
