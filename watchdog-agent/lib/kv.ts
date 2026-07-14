import { kv } from "@vercel/kv";
import type { WatchTarget, Snapshot, WatchEvent } from "./types";

const TARGET_KEY = (id: string) => `target:${id}`;
const TARGET_INDEX = "targets:index";
const SNAPSHOT_KEY = (id: string) => `snapshot:${id}`;
const EVENTS_KEY = (id: string) => `events:${id}`;

export async function saveTarget(target: WatchTarget) {
  await kv.set(TARGET_KEY(target.id), target);
  await kv.sadd(TARGET_INDEX, target.id);
}

export async function getTarget(id: string): Promise<WatchTarget | null> {
  return (await kv.get<WatchTarget>(TARGET_KEY(id))) ?? null;
}

export async function listTargets(): Promise<WatchTarget[]> {
  const ids = await kv.smembers(TARGET_INDEX);
  if (!ids.length) return [];
  const targets = await Promise.all(ids.map((id) => getTarget(id)));
  return targets.filter((t): t is WatchTarget => t !== null);
}

export async function getLastSnapshot(targetId: string): Promise<Snapshot | null> {
  return (await kv.get<Snapshot>(SNAPSHOT_KEY(targetId))) ?? null;
}

export async function saveSnapshot(snapshot: Snapshot) {
  await kv.set(SNAPSHOT_KEY(snapshot.targetId), snapshot);
}

export async function logEvent(event: WatchEvent) {
  // Keep the last 200 events per target, newest first.
  await kv.lpush(EVENTS_KEY(event.targetId), JSON.stringify(event));
  await kv.ltrim(EVENTS_KEY(event.targetId), 0, 199);
}

export async function getEvents(targetId: string): Promise<WatchEvent[]> {
  const raw = await kv.lrange(EVENTS_KEY(targetId), 0, 199);
  return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r)) as WatchEvent[];
}

// Simple fixed-window rate limit for the free web demo lane, keyed by IP.
// Keeps the no-payment demo from being used as a free substitute for the paid API.
export async function checkAndIncrementRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const rateKey = `ratelimit:${key}`;
  const count = await kv.incr(rateKey);
  if (count === 1) {
    await kv.expire(rateKey, windowSeconds);
  }
  return count <= limit;
}

// Global, all-time counters for real-usage proof on the landing page.
export async function bumpStat(name: string, by: number = 1) {
  if (by > 0) {
    await kv.incrby(`stats:${name}`, by);
  }
}

export async function getStats() {
  const [totalChecks, totalEvents, targets] = await Promise.all([
    kv.get<number>("stats:totalChecks"),
    kv.get<number>("stats:totalEvents"),
    listTargets(),
  ]);
  return {
    totalChecks: totalChecks ?? 0,
    totalEvents: totalEvents ?? 0,
    activeTargets: targets.length,
  };
}
