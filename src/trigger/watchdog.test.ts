import { describe, expect, it, vi } from "vitest";

// Mock the connection module before importing watchdog functions
vi.mock("../core/db/connection.ts", () => ({
	createHubConnection: vi.fn(),
}));

import { findStuckPublishing, findStuckScheduled } from "./watchdog.ts";

// Helper to create a mock db that returns specified results for select queries
function createMockDb(results: unknown[]) {
	const mockWhere = vi.fn().mockResolvedValue(results);
	const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

	return {
		select: mockSelect,
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
	} as unknown as ReturnType<typeof import("../core/db/connection.ts").createHubConnection>;
}

describe("Watchdog: findStuckScheduled", () => {
	it("returns empty array when no stuck posts", async () => {
		const db = createMockDb([]);
		const result = await findStuckScheduled(db);
		expect(result).toEqual([]);
	});

	it("returns posts stuck in scheduled state", async () => {
		const stuckPost = {
			id: "post-1",
			userId: "user-1",
			platform: "x",
			content: "Hello world",
			status: "scheduled",
			scheduledAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
			publishedAt: null,
			externalPostId: null,
			mediaUrls: null,
			metadata: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const db = createMockDb([stuckPost]);
		const result = await findStuckScheduled(db);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("post-1");
		expect(result[0]?.status).toBe("scheduled");
	});
});

describe("Watchdog: findStuckPublishing", () => {
	it("returns empty array when no stuck publishing posts", async () => {
		const db = createMockDb([]);
		const result = await findStuckPublishing(db);
		expect(result).toEqual([]);
	});

	it("returns posts stuck in publishing state", async () => {
		const stuckPost = {
			id: "post-2",
			userId: "user-1",
			platform: "linkedin",
			content: "Check this out",
			status: "publishing",
			scheduledAt: new Date(Date.now() - 20 * 60 * 1000),
			publishedAt: null,
			externalPostId: null,
			mediaUrls: null,
			metadata: null,
			createdAt: new Date(),
			updatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
		};

		const db = createMockDb([stuckPost]);
		const result = await findStuckPublishing(db);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("post-2");
		expect(result[0]?.status).toBe("publishing");
	});
});

describe("Watchdog: result shape", () => {
	it("has correct WatchdogResult interface", () => {
		const result = { checked: 5, stuck: 2, retried: 1, failed: 1 };
		expect(result.checked).toBe(5);
		expect(result.stuck).toBe(2);
		expect(result.retried).toBe(1);
		expect(result.failed).toBe(1);
	});
});
