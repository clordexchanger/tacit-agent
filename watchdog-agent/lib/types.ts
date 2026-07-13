// The contract other agents (or OKX AI reviewers) will read/write against.

export type CheckType = "content" | "status" | "latency" | "schema";

export interface WatchTarget {
  id: string;
  url: string;
  checkType: CheckType;
  intervalMinutes: number;
  // threshold meaning depends on checkType:
  // - latency: ms above which we alert
  // - content/schema: no threshold needed, any diff alerts
  // - status: expected status code (default 200)
  threshold?: number;
  webhookUrl?: string;
  createdAt: number;
  lastCheckedAt?: number;
  isDemo?: boolean; // true for targets created via the free web demo, not the paid x402 API
}

export interface Snapshot {
  targetId: string;
  status: number;
  latencyMs: number;
  bodyHash: string;
  bodyShapeHash: string; // hash of JSON key structure, for schema checks
  takenAt: number;
}

export interface WatchEvent {
  id: string;
  targetId: string;
  changeType: CheckType | "error";
  oldValue: unknown;
  newValue: unknown;
  severity: "info" | "warning" | "critical";
  timestamp: number;
}

export interface CreateWatchInput {
  url: string;
  checkType: CheckType;
  intervalMinutes?: number;
  threshold?: number;
  webhookUrl?: string;
}
