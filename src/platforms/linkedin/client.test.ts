/**
 * Tests for LinkedInClient.getAdminOrganizations().
 * Verifies correct API call, response parsing, and graceful org name lookup failure.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { LinkedInClient } from "./client.ts";

// Build a mock Response with the headers LinkedIn's request() method expects
function linkedInResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"x-li-throttle-count": "100",
			"x-li-throttle-reset": "0",
		},
	});
}

describe("LinkedInClient", () => {
	const originalFetch = globalThis.fetch;
	let fetchSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		fetchSpy = mock(() => Promise.resolve(new Response()));
		globalThis.fetch = fetchSpy as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe("getAdminOrganizations()", () => {
		it("returns organizations with names from API", async () => {
			// Import fresh after mocks are set
			const client = new LinkedInClient("test_token");

			// 1st call: organizationAcls
			fetchSpy.mockResolvedValueOnce(
				linkedInResponse({
					elements: [
						{ organization: "urn:li:organization:12345" },
						{ organization: "urn:li:organization:67890" },
					],
				}),
			);

			// 2nd call: org name lookup for 12345
			fetchSpy.mockResolvedValueOnce(linkedInResponse({ localizedName: "Acme Corp" }));

			// 3rd call: org name lookup for 67890
			fetchSpy.mockResolvedValueOnce(linkedInResponse({ localizedName: "Widget Inc" }));

			const orgs = await client.getAdminOrganizations();

			expect(orgs).toHaveLength(2);
			expect(orgs[0]).toEqual({
				organizationUrn: "urn:li:organization:12345",
				organizationName: "Acme Corp",
			});
			expect(orgs[1]).toEqual({
				organizationUrn: "urn:li:organization:67890",
				organizationName: "Widget Inc",
			});

			// Verify the ACL call used correct endpoint
			expect(fetchSpy.mock.calls[0]?.[0]).toContain(
				"/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
			);
		});

		it("returns organizations without names when name lookup fails", async () => {
			const client = new LinkedInClient("test_token");

			// organizationAcls response
			fetchSpy.mockResolvedValueOnce(
				linkedInResponse({
					elements: [{ organization: "urn:li:organization:99999" }],
				}),
			);

			// org name lookup fails (403)
			fetchSpy.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));

			const orgs = await client.getAdminOrganizations();

			expect(orgs).toHaveLength(1);
			expect(orgs[0]).toEqual({
				organizationUrn: "urn:li:organization:99999",
				organizationName: undefined,
			});
		});
	});
});
