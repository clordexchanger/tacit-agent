import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { saveTarget, listTargets } from "@/lib/kv";
import { withX402 } from "@/lib/x402";
import type { CreateWatchInput, WatchTarget } from "@/lib/types";

async function handlePost(req: NextRequest) {
  const body = (await req.json()) as CreateWatchInput;

  if (!body.url || !body.checkType) {
    return NextResponse.json({ error: "url and checkType are required" }, { status: 400 });
  }

  const target: WatchTarget = {
    id: randomUUID(),
    url: body.url,
    checkType: body.checkType,
    intervalMinutes: body.intervalMinutes ?? 5,
    threshold: body.threshold,
    webhookUrl: body.webhookUrl,
    createdAt: Date.now(),
  };

  await saveTarget(target);
  return NextResponse.json({ target }, { status: 201 });
}

export const POST = withX402(handlePost, {
  priceUsd: 0.02,
  description: "Register a new watch target with the Watchdog Agent",
});

export async function GET() {
  const targets = await listTargets();
  return NextResponse.json({ targets });
}
