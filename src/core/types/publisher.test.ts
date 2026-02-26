import { describe, expect, it } from "vitest";
import type { Platform, PlatformPublisher, RateLimitInfo } from "./publisher.ts";

// ─── Mock Implementation ─────────────────────────────────────────────────────

/**
 * Minimal mock that satisfies the PlatformPublisher interface.
 * Used to verify that the interface contract is properly defined and that
 * implementing classes can be tested without real platform credentials.
 */
class MockPublisher implements PlatformPublisher {
	private rateLimitInfo: RateLimitInfo | null = null;
	private rateLimited = false;
	private retryAfterSeconds = 0;
	private credentialsValid = true;

	async publish(
		_db: unknown,
		_post: unknown,
		_encKey: unknown,
	): Promise<{
		platform: Platform;
		status: "published" | "failed" | "skipped";
		externalPostId?: string;
		error?: string;
	}> {
		return {
			platform: "x" as const,
			status: "published" as const,
			externalPostId: "tweet_123",
		};
	}

	async validateCredentials(): Promise<boolean> {
		return this.credentialsValid;
	}

	getRateLimitInfo(): RateLimitInfo | null {
		return this.rateLimitInfo;
	}

	async refreshCredentials(_db: unknown, _encKey: unknown): Promise<void> {
		// No-op for mock
	}

	isRateLimited(): boolean {
		return this.rateLimited;
	}

	getRetryAfter(): number {
		return this.retryAfterSeconds;
	}

	// ─── Test helpers ────────────────────────────────────────────────────────

	setRateLimit(info: RateLimitInfo): void {
		this.rateLimitInfo = info;
		this.rateLimited = true;
		const secondsRemaining = Math.max(
			0,
			Math.floor((info.resetAt.getTime() - Date.now()) / 1000),
		);
		this.retryAfterSeconds = secondsRemaining;
	}

	clearRateLimit(): void {
		this.rateLimitInfo = null;
		this.rateLimited = false;
		this.retryAfterSeconds = 0;
	}

	setCredentialsValid(valid: boolean): void {
		this.credentialsValid = valid;
	}
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PlatformPublisher interface compliance", () => {
	describe("method presence", () => {
		it("should implement all required interface methods", () => {
			const publisher = new MockPublisher();
			expect(typeof publisher.publish).toBe("function");
			expect(typeof publisher.validateCredentials).toBe("function");
			expect(typeof publisher.getRateLimitInfo).toBe("function");
			expect(typeof publisher.refreshCredentials).toBe("function");
			expect(typeof publisher.isRateLimited).toBe("function");
			expect(typeof publisher.getRetryAfter).toBe("function");
		});
	});

	describe("publish()", () => {
		it("should return a PlatformPublishResult with all required fields", async () => {
			const publisher = new MockPublisher();
			const result = await publisher.publish(
				{} as never,
				{} as never,
				Buffer.from("key"),
			);
			expect(result).toHaveProperty("platform");
			expect(result).toHaveProperty("status");
		});

		it("should return a valid status value", async () => {
			const publisher = new MockPublisher();
			const result = await publisher.publish(
				{} as never,
				{} as never,
				Buffer.from("key"),
			);
			const validStatuses: Array<"published" | "failed" | "skipped"> = [
				"published",
				"failed",
				"skipped",
			];
			expect(validStatuses).toContain(result.status);
		});

		it("should return a valid platform value", async () => {
			const publisher = new MockPublisher();
			const result = await publisher.publish(
				{} as never,
				{} as never,
				Buffer.from("key"),
			);
			const validPlatforms: Platform[] = [
				"x",
				"linkedin",
				"instagram",
				"tiktok",
			];
			expect(validPlatforms).toContain(result.platform);
		});

		it("should include externalPostId when published successfully", async () => {
			const publisher = new MockPublisher();
			const result = await publisher.publish(
				{} as never,
				{} as never,
				Buffer.from("key"),
			);
			if (result.status === "published") {
				expect(result.externalPostId).toBeDefined();
			}
		});
	});

	describe("validateCredentials()", () => {
		it("should return a boolean", async () => {
			const publisher = new MockPublisher();
			const result = await publisher.validateCredentials();
			expect(typeof result).toBe("boolean");
		});

		it("should return true when credentials are valid", async () => {
			const publisher = new MockPublisher();
			publisher.setCredentialsValid(true);
			expect(await publisher.validateCredentials()).toBe(true);
		});

		it("should return false when credentials are invalid", async () => {
			const publisher = new MockPublisher();
			publisher.setCredentialsValid(false);
			expect(await publisher.validateCredentials()).toBe(false);
		});
	});

	describe("getRateLimitInfo()", () => {
		it("should return null when no API call has been made", () => {
			const publisher = new MockPublisher();
			expect(publisher.getRateLimitInfo()).toBeNull();
		});

		it("should return RateLimitInfo after rate limit is set", () => {
			const publisher = new MockPublisher();
			const resetAt = new Date(Date.now() + 60_000);
			publisher.setRateLimit({ limit: 100, remaining: 0, resetAt });

			const info = publisher.getRateLimitInfo();
			expect(info).not.toBeNull();
			expect(info?.limit).toBe(100);
			expect(info?.remaining).toBe(0);
			expect(info?.resetAt).toEqual(resetAt);
		});

		it("should return null after rate limit is cleared", () => {
			const publisher = new MockPublisher();
			publisher.setRateLimit({
				limit: 100,
				remaining: 0,
				resetAt: new Date(Date.now() + 60_000),
			});
			publisher.clearRateLimit();
			expect(publisher.getRateLimitInfo()).toBeNull();
		});
	});

	describe("refreshCredentials()", () => {
		it("should resolve without throwing for valid credentials", async () => {
			const publisher = new MockPublisher();
			await expect(
				publisher.refreshCredentials({} as never, Buffer.from("key")),
			).resolves.toBeUndefined();
		});
	});

	describe("isRateLimited()", () => {
		it("should return false initially", () => {
			const publisher = new MockPublisher();
			expect(publisher.isRateLimited()).toBe(false);
		});

		it("should return true when rate limited", () => {
			const publisher = new MockPublisher();
			publisher.setRateLimit({
				limit: 100,
				remaining: 0,
				resetAt: new Date(Date.now() + 60_000),
			});
			expect(publisher.isRateLimited()).toBe(true);
		});

		it("should return false after rate limit is cleared", () => {
			const publisher = new MockPublisher();
			publisher.setRateLimit({
				limit: 100,
				remaining: 0,
				resetAt: new Date(Date.now() + 60_000),
			});
			publisher.clearRateLimit();
			expect(publisher.isRateLimited()).toBe(false);
		});
	});

	describe("getRetryAfter()", () => {
		it("should return 0 when not rate limited", () => {
			const publisher = new MockPublisher();
			expect(publisher.getRetryAfter()).toBe(0);
		});

		it("should return a positive number when rate limited with future reset", () => {
			const publisher = new MockPublisher();
			publisher.setRateLimit({
				limit: 100,
				remaining: 0,
				resetAt: new Date(Date.now() + 120_000), // 2 minutes from now
			});
			expect(publisher.getRetryAfter()).toBeGreaterThan(0);
		});

		it("should return 0 after rate limit is cleared", () => {
			const publisher = new MockPublisher();
			publisher.setRateLimit({
				limit: 100,
				remaining: 0,
				resetAt: new Date(Date.now() + 60_000),
			});
			publisher.clearRateLimit();
			expect(publisher.getRetryAfter()).toBe(0);
		});
	});

	describe("RateLimitInfo type shape", () => {
		it("should enforce required fields on RateLimitInfo", () => {
			const info: RateLimitInfo = {
				limit: 500,
				remaining: 42,
				resetAt: new Date("2026-01-01T00:00:00Z"),
			};
			expect(info.limit).toBe(500);
			expect(info.remaining).toBe(42);
			expect(info.resetAt).toBeInstanceOf(Date);
		});
	});
});
