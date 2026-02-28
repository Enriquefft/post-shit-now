import { exec } from "node:child_process";
import { OAUTH_CALLBACK_HOSTNAME, OAUTH_CALLBACK_PORT } from "../platforms/x/oauth.ts";

// ── Types ──────────────────────────────────────────────────────────────

export interface CallbackResult {
	code: string;
	state: string;
}

export interface CallbackError {
	error: "timeout" | "state_mismatch" | "port_unavailable" | "missing_params";
	message: string;
}

export type CallbackOutcome =
	| { ok: true; result: CallbackResult }
	| { ok: false; error: CallbackError };

// ── HTML ───────────────────────────────────────────────────────────────

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>Authorization Complete</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa">
  <div style="text-align:center">
    <h1 style="color:#22c55e">Authorization complete!</h1>
    <p>You can close this tab.</p>
  </div>
  <script>setTimeout(()=>window.close(),3000)</script>
</body>
</html>`;

// ── Callback Server ────────────────────────────────────────────────────

/**
 * Start an ephemeral HTTP server that listens for a single OAuth callback.
 * Returns a promise that resolves when the callback is received, the server
 * times out, or the port is unavailable.
 */
export function startCallbackServer(
	expectedState: string,
	options: { port: number; hostname: string; timeoutMs: number },
): Promise<CallbackOutcome> {
	const { promise, resolve } = Promise.withResolvers<CallbackOutcome>();

	let server: ReturnType<typeof Bun.serve> | undefined;
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		server = Bun.serve({
			port: options.port,
			hostname: options.hostname,
			fetch(req) {
				const url = new URL(req.url);

				if (url.pathname !== "/callback") {
					return new Response("", { status: 404 });
				}

				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");

				if (!code || !state) {
					return new Response("Missing parameters", { status: 400 });
				}

				if (state !== expectedState) {
					return new Response("Invalid state parameter", { status: 403 });
				}

				// Valid callback -- clear timeout, respond, then shut down
				if (timeout) clearTimeout(timeout);

				queueMicrotask(() => {
					server?.stop();
					resolve({ ok: true, result: { code, state } });
				});

				return new Response(SUCCESS_HTML, {
					headers: { "Content-Type": "text/html" },
				});
			},
		});
	} catch {
		return Promise.resolve({
			ok: false,
			error: {
				error: "port_unavailable" as const,
				message: `Port ${options.port} is in use. Cannot start OAuth callback server.`,
			},
		});
	}

	// Set timeout to auto-shutdown if no callback received
	const srv = server;
	timeout = setTimeout(() => {
		srv.stop();
		resolve({
			ok: false,
			error: {
				error: "timeout" as const,
				message: `OAuth callback not received within ${options.timeoutMs}ms.`,
			},
		});
	}, options.timeoutMs);

	return promise;
}

// ── Browser Helpers ────────────────────────────────────────────────────

/**
 * Detect whether the current environment can open a browser.
 * Returns false for SSH sessions and headless Linux.
 */
export function canOpenBrowser(): boolean {
	if (process.env.SSH_CLIENT || process.env.SSH_TTY) return false;
	if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
		return false;
	}
	return true;
}

/**
 * Attempt to open a URL in the default browser.
 * Returns true if the command was launched, false on error.
 */
export function openBrowser(url: string): boolean {
	try {
		const escaped = url.replace(/"/g, '\\"');
		switch (process.platform) {
			case "darwin":
				exec(`open "${escaped}"`);
				break;
			case "win32":
				exec(`start "" "${escaped}"`);
				break;
			default:
				exec(`xdg-open "${escaped}"`);
				break;
		}
		return true;
	} catch {
		return false;
	}
}

// ── High-Level Orchestrator ────────────────────────────────────────────

/**
 * Capture an OAuth authorization code by starting a local callback server
 * and optionally opening the auth URL in the user's browser.
 *
 * This is the primary public API for OAuth callback capture.
 */
export async function captureOAuthCallback(
	expectedState: string,
	options: { authUrl: string; timeoutMs: number },
): Promise<CallbackOutcome> {
	// Start the server (synchronous Bun.serve wrapped in try/catch)
	const serverPromise = startCallbackServer(expectedState, {
		port: OAUTH_CALLBACK_PORT,
		hostname: OAUTH_CALLBACK_HOSTNAME,
		timeoutMs: options.timeoutMs,
	});

	// Open browser if possible (fire-and-forget)
	if (canOpenBrowser()) {
		openBrowser(options.authUrl);
	}

	return serverPromise;
}
