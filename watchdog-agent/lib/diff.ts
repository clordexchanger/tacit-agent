import { createHash } from "crypto";
import type { WatchTarget, Snapshot, WatchEvent } from "./types";

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Recursively replaces all leaf values with their type, so two JSON bodies
// with the same "shape" hash the same even if the actual values differ.
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? [shapeOf(value[0])] : [];
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = shapeOf((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return typeof value;
}

export async function takeSnapshot(target: WatchTarget): Promise<{
  snapshot: Snapshot;
  error?: string;
}> {
  const start = Date.now();
  try {
    const res = await fetch(target.url, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    const latencyMs = Date.now() - start;
    const bodyText = await res.text();

    let bodyShapeHash = "";
    try {
      bodyShapeHash = hash(JSON.stringify(shapeOf(JSON.parse(bodyText))));
    } catch {
      bodyShapeHash = "not-json";
    }

    return {
      snapshot: {
        targetId: target.id,
        status: res.status,
        latencyMs,
        bodyHash: hash(bodyText),
        bodyShapeHash,
        takenAt: Date.now(),
      },
    };
  } catch (err) {
    return {
      snapshot: {
        targetId: target.id,
        status: 0,
        latencyMs: Date.now() - start,
        bodyHash: "",
        bodyShapeHash: "",
        takenAt: Date.now(),
      },
      error: err instanceof Error ? err.message : "unknown fetch error",
    };
  }
}

export function diffSnapshots(
  target: WatchTarget,
  prev: Snapshot | null,
  current: Snapshot,
  fetchError?: string
): WatchEvent[] {
  const events: WatchEvent[] = [];
  const base = {
    id: `${target.id}-${current.takenAt}`,
    targetId: target.id,
    timestamp: current.takenAt,
  };

  if (fetchError) {
    events.push({
      ...base,
      changeType: "error",
      oldValue: null,
      newValue: fetchError,
      severity: "critical",
    });
    return events; // no meaningful comparison possible
  }

  if (!prev) return events; // first check, nothing to compare yet

  const expectedStatus = target.threshold ?? 200;
  if (target.checkType === "status" && current.status !== expectedStatus) {
    events.push({
      ...base,
      changeType: "status",
      oldValue: prev.status,
      newValue: current.status,
      severity: "critical",
    });
  }

  if (target.checkType === "latency" && target.threshold && current.latencyMs > target.threshold) {
    events.push({
      ...base,
      changeType: "latency",
      oldValue: prev.latencyMs,
      newValue: current.latencyMs,
      severity: "warning",
    });
  }

  if (target.checkType === "content" && current.bodyHash !== prev.bodyHash) {
    events.push({
      ...base,
      changeType: "content",
      oldValue: prev.bodyHash,
      newValue: current.bodyHash,
      severity: "info",
    });
  }

  if (target.checkType === "schema" && current.bodyShapeHash !== prev.bodyShapeHash) {
    events.push({
      ...base,
      changeType: "schema",
      oldValue: prev.bodyShapeHash,
      newValue: current.bodyShapeHash,
      severity: "warning",
    });
  }

  return events;
}
