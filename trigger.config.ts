import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
	runtime: "bun",
	project: "<your-project-ref>", // Replaced during /psn:setup
	dirs: ["./src/trigger"],
	retries: {
		enabledInDev: false,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	maxDuration: 300,
});
