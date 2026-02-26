import type { Platform } from "../types/index.ts";
import type { PlatformPublisher } from "../types/publisher.ts";

// NOTE: Concrete handler classes are implemented in Plan 21-02.
// The factory uses a registration pattern to avoid circular dependencies —
// each handler module registers itself when imported; the factory never
// imports handler modules directly.

/**
 * Constructor signature for platform handler classes.
 * Handlers may accept arbitrary constructor arguments (credentials, config, etc.)
 * which are forwarded by the factory via rest parameters.
 */
export type HandlerConstructor = new (...args: unknown[]) => PlatformPublisher;

/**
 * Internal registry mapping platform identifiers to their handler constructors.
 * Declared as Partial so unregistered platforms are represented as undefined
 * rather than causing a TypeScript error at the definition site.
 */
type HandlerRegistry = Partial<Record<Platform, HandlerConstructor>>;

const handlerRegistry: HandlerRegistry = {};

/**
 * Register a handler class for a platform.
 *
 * Called by handler modules during their module initialisation (top-level
 * side-effect). This pattern keeps the factory decoupled from concrete
 * implementations and avoids circular import chains.
 *
 * @example
 * // src/platforms/x/handler.ts
 * registerHandler("x", XHandler);
 *
 * @param platform - The platform identifier to register the handler for
 * @param handler  - The handler constructor that implements PlatformPublisher
 */
export function registerHandler(
	platform: Platform,
	handler: HandlerConstructor,
): void {
	handlerRegistry[platform] = handler;
}

/**
 * Create a platform handler instance.
 *
 * Looks up the registered constructor for `platform` and instantiates it,
 * forwarding any additional arguments to the constructor. This allows callers
 * to inject credentials, config, or other dependencies without the factory
 * needing to know the concrete handler's constructor signature.
 *
 * @throws Error if no handler has been registered for the given platform
 *
 * @param platform - The platform to create a handler for
 * @param args     - Constructor arguments forwarded to the handler class
 * @returns A PlatformPublisher instance for the requested platform
 *
 * @example
 * registerHandler("x", XHandler);
 * const handler = createHandler("x", { userId: "u_123", db });
 */
export function createHandler(
	platform: Platform,
	...args: unknown[]
): PlatformPublisher {
	const HandlerClass = handlerRegistry[platform];
	if (!HandlerClass) {
		throw new Error(
			`No handler registered for platform: ${platform}. ` +
				`Call registerHandler("${platform}", YourHandlerClass) before createHandler().`,
		);
	}
	return new HandlerClass(...args);
}

/**
 * Check whether a handler has been registered for a platform.
 *
 * Useful for feature-flag checks — callers can skip platforms that have
 * no registered handler rather than catching the error from createHandler().
 *
 * @param platform - The platform identifier to check
 * @returns true if a handler is registered, false otherwise
 */
export function hasHandler(platform: Platform): boolean {
	return platform in handlerRegistry;
}

/**
 * Return all platforms that currently have a registered handler.
 *
 * Useful for iterating over enabled platforms in multi-platform publish flows.
 *
 * @returns Array of Platform values with registered handlers (may be empty)
 */
export function registeredPlatforms(): Platform[] {
	return Object.keys(handlerRegistry) as Platform[];
}

/**
 * Unregister a handler for a platform (primarily for test teardown).
 *
 * @param platform - The platform to deregister
 */
export function unregisterHandler(platform: Platform): void {
	delete handlerRegistry[platform];
}
