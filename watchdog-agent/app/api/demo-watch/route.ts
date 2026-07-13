import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveTarget, listTargets, checkAndIncrementRateLimit } from "@/lib/kv";
import type { CreateWatchInput, WatchTarget } from "@/lib/types";

// Free, rate-limited lane for the interactive web demo only.
// The real paid API is /api/watch, gated by x402. This route intentionally
// cannot be used to check arbitrary existing targets — see the check route,
// which refuses anything that isn't isDemo.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = await checkAndIncrementRateLimit(`demo:${ip}`, 8, 3600);

  if (!allowed) {
    return NextResponse.json(
      { error: "Demo limit reached for this hour. The paid API at /api/watch has no such limit." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as CreateWatchInput;
  if (!body.url || !body.checkType) {
    return NextResponse.json({ error: "url and checkType are required" }, { status: 400 });
  }

  const target: WatchTarget = {
    id: randomUUID(),
    url: body.url,
    checkType: body.checkType,
    intervalMinutes: Math.max(body.intervalMinutes ?? 1, 1),
    threshold: body.threshold,
    createdAt: Date.now(),
    isDemo: true,
  };

  await saveTarget(target);
  return NextResponse.json({ target }, { status: 201 });
}

// Public board of demo targets only — never exposes paid/agent targets.
export async function GET() {
  const all = await listTargets();
  const board = all
    .filter((t) => t.isDemo)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((t) => ({
      id: t.id,
      url: t.url,
      checkType: t.checkType,
      createdAt: t.createdAt,
      lastCheckedAt: t.lastCheckedAt ?? null,
    }));

  return NextResponse.json({ board });
}
