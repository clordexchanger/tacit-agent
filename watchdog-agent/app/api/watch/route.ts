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
  description: "Register a new watch target with TACIT",
});

// Not used by the product itself (the live board uses the separate,
// demo-scoped /api/demo-watch listing) — gated so it can't leak every
// registered target's URL and webhook to anyone who calls it.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const targets = await listTargets();
  return NextResponse.json({ targets });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-payment",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, X-PAYMENT-RESPONSE",
    },
  });
}
