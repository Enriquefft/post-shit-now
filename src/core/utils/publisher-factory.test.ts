import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Platform } from "../types/index.ts";
import type { PlatformPublisher, RateLimitInfo } from "../types/publisher.ts";
import {
	createHandler,
	hasHandler,
	registerHandler,
	registeredPlatforms,
	unregisterHandler,
} from "./publisher-factory.ts";

// ─── Test Fixture ─────────────────────────────────────────────────────────────

/**
 * Minimal mock handler used as fixture for factory tests.
 * Implements PlatformPublisher so TypeScript is satisfied with registerHandler().
 */
class MockHandler implements PlatformPublisher {
	readonly constructorArgs: unknown[];

	constructor(...args: unknown[]) {
		this.constructorArgs = args;
	}

	async publish(): Promise<{
		platform: Platform;
		status: "published" | "failed" | "skipped";
	}> {
		return { platform: "x", status: "published" };
	}

	async validateCredentials(): Promise<boolean> {
		return true;
	}

	getRateLimitInfo(): RateLimitInfo | null {
		return null;
	}

	async refreshCredentials(): Promise<void> {}

	isRateLimited(): boolean {
		return false;
	}

	getRetryAfter(): number {
		return 0;
	}
}

class MockLinkedInHandler extends MockHandler {}
class MockInstagramHandler extends MockHandler {}
class MockTikTokHandler extends MockHandler {}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("publisher-factory", () => {
	// Clean up registered handlers between tests to prevent cross-test pollution
	const TEST_PLATFORMS: Platform[] = ["x", "linkedin", "instagram", "tiktok"];

	beforeEach(() => {
		for (const platform of TEST_PLATFORMS) {
			unregisterHandler(platform);
		}
	});

	afterEach(() => {
		for (const platform of TEST_PLATFORMS) {
			unregisterHandler(platform);
		}
	});

	// ─── registerHandler ───────────────────────────────────────────────────

	describe("registerHandler()", () => {
		it("should register a handler without throwing", () => {
			expect(() => registerHandler("x", MockHandler)).not.toThrow();
		});

		it("should allow overwriting an existing registration", () => {
			registerHandler("x", MockHandler);
			expect(() => registerHandler("x", MockLinkedInHandler)).not.toThrow();

			// The second registration should take effect
			const handler = createHandler("x");
			expect(handler).toBeInstanceOf(MockLinkedInHandler);
		});

		it("should register handlers for all four platforms", () => {
			registerHandler("x", MockHandler);
			registerHandler("linkedin", MockLinkedInHandler);
			registerHandler("instagram", MockInstagramHandler);
			registerHandler("tiktok", MockTikTokHandler);

			expect(hasHandler("x")).toBe(true);
			expect(hasHandler("linkedin")).toBe(true);
			expect(hasHandler("instagram")).toBe(true);
			expect(hasHandler("tiktok")).toBe(true);
		});
	});

	// ─── createHandler ────────────────────────────────────────────────────

	describe("createHandler()", () => {
		it("should create a handler instance for a registered platform", () => {
			registerHandler("x", MockHandler);
			const handler = createHandler("x");
			expect(handler).toBeInstanceOf(MockHandler);
		});

		it("should implement PlatformPublisher interface on created instance", () => {
			registerHandler("x", MockHandler);
			const handler = createHandler("x");
			expect(typeof handler.publish).toBe("function");
			expect(typeof handler.validateCredentials).toBe("function");
			expect(typeof handler.getRateLimitInfo).toBe("function");
			expect(typeof handler.refreshCredentials).toBe("function");
			expect(typeof handler.isRateLimited).toBe("function");
			expect(typeof handler.getRetryAfter).toBe("function");
		});

		it("should throw an error when no handler is registered for the platform", () => {
			expect(() => createHandler("x")).toThrow(
				/No handler registered for platform: x/,
			);
		});

		it("should include helpful guidance in error message", () => {
			expect(() => createHandler("linkedin")).toThrow(/registerHandler/);
		});

		it("should forward constructor arguments to the handler class", () => {
			registerHandler("x", MockHandler);
			const arg1 = { userId: "u_123" };
			const arg2 = "extra-arg";
			const handler = createHandler("x", arg1, arg2) as MockHandler;
			expect(handler.constructorArgs[0]).toBe(arg1);
			expect(handler.constructorArgs[1]).toBe(arg2);
		});

		it("should create different handler types per platform", () => {
			registerHandler("x", MockHandler);
			registerHandler("linkedin", MockLinkedInHandler);

			const xHandler = createHandler("x");
			const linkedinHandler = createHandler("linkedin");

			expect(xHandler).toBeInstanceOf(MockHandler);
			expect(linkedinHandler).toBeInstanceOf(MockLinkedInHandler);
			expect(xHandler).not.toBeInstanceOf(MockLinkedInHandler);
		});

		it("should create a new instance on each call", () => {
			registerHandler("x", MockHandler);
			const handler1 = createHandler("x");
			const handler2 = createHandler("x");
			expect(handler1).not.toBe(handler2);
		});
	});

	// ─── hasHandler ───────────────────────────────────────────────────────

	describe("hasHandler()", () => {
		it("should return false for unregistered platform", () => {
			expect(hasHandler("x")).toBe(false);
		});

		it("should return true after registering a handler", () => {
			registerHandler("x", MockHandler);
			expect(hasHandler("x")).toBe(true);
		});

		it("should return false after unregistering a handler", () => {
			registerHandler("x", MockHandler);
			unregisterHandler("x");
			expect(hasHandler("x")).toBe(false);
		});
	});

	// ─── registeredPlatforms ──────────────────────────────────────────────

	describe("registeredPlatforms()", () => {
		it("should return an empty array when no handlers registered", () => {
			expect(registeredPlatforms()).toEqual([]);
		});

		it("should return the platform after registration", () => {
			registerHandler("x", MockHandler);
			expect(registeredPlatforms()).toContain("x");
		});

		it("should return all registered platforms", () => {
			registerHandler("x", MockHandler);
			registerHandler("linkedin", MockLinkedInHandler);
			const platforms = registeredPlatforms();
			expect(platforms).toContain("x");
			expect(platforms).toContain("linkedin");
			expect(platforms).toHaveLength(2);
		});
	});

	// ─── unregisterHandler ────────────────────────────────────────────────

	describe("unregisterHandler()", () => {
		it("should silently succeed when deregistering an unregistered platform", () => {
			expect(() => unregisterHandler("x")).not.toThrow();
		});

		it("should remove the handler so createHandler throws", () => {
			registerHandler("x", MockHandler);
			unregisterHandler("x");
			expect(() => createHandler("x")).toThrow(/No handler registered/);
		});
	});
});
