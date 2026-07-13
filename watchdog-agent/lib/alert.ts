import type { WatchEvent, WatchTarget } from "./types";

export async function dispatchAlert(target: WatchTarget, event: WatchEvent) {
  if (!target.webhookUrl) return;

  try {
    await fetch(target.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: target.url, event }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Webhook delivery failures are logged via the event history itself
    // (getEvents), so a silent failure here doesn't lose the underlying event.
  }
}
