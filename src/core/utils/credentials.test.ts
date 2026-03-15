import { describe, expect, it } from "bun:test";

/**
 * Unit tests for resolveCredentials.
 *
 * Due to bun 1.3.x mock.module cross-file contamination, handler tests
 * can leak their credentials mock into this file. We test via a standalone
 * subprocess script to guarantee isolation.
 */

async function runIsolated(script: string): Promise<number> {
	const proc = Bun.spawn(["bun", "run", "--eval", script], {
		cwd: import.meta.dir,
		env: { ...process.env },
	});
	return proc.exited;
}

describe("resolveCredentials", () => {
	it("returns all credentials when all keys exist", async () => {
		const code = await runIsolated(`
import { mock } from "bun:test";
mock.module("../db/api-keys", () => ({
	getApiKey: async (_db, _hubId, service, keyName) => {
		const store = { x: { client_id: "x_id", client_secret: "x_secret" } };
		const val = store[service]?.[keyName];
		if (!val) throw new Error("not found");
		return val;
	},
}));
const { resolveCredentials } = await import("./credentials.ts");
const r = await resolveCredentials({}, "hub-1", "x", ["client_id", "client_secret"]);
if (!r || r.client_id !== "x_id" || r.client_secret !== "x_secret") process.exit(1);
`);
		expect(code).toBe(0);
	});

	it("returns null when any key is missing", async () => {
		const code = await runIsolated(`
import { mock } from "bun:test";
mock.module("../db/api-keys", () => ({
	getApiKey: async (_db, _hubId, service, keyName) => {
		if (service === "linkedin" && keyName === "client_id") return "li_id";
		throw new Error("not found");
	},
}));
const { resolveCredentials } = await import("./credentials.ts");
const r = await resolveCredentials({}, "hub-1", "linkedin", ["client_id", "client_secret"]);
if (r !== null) process.exit(1);
`);
		expect(code).toBe(0);
	});

	it("returns null when all keys are missing", async () => {
		const code = await runIsolated(`
import { mock } from "bun:test";
mock.module("../db/api-keys", () => ({
	getApiKey: async () => { throw new Error("not found"); },
}));
const { resolveCredentials } = await import("./credentials.ts");
const r = await resolveCredentials({}, "hub-1", "nope", ["a", "b"]);
if (r !== null) process.exit(1);
`);
		expect(code).toBe(0);
	});
});
