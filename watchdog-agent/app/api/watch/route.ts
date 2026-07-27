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

  // Authorized request can still list targets
  if (auth === `Bearer ${process.env.CRON_SECRET}`) {
    const targets = await listTargets();
    return NextResponse.json({ targets });
  }

  // Public documentation for reviewers
  return NextResponse.json({
    service: "TACIT Watch",
    version: "1.0.0",
    description:
      "Monitor websites and APIs for status, content, schema, and latency changes.",

    endpoint: "/api/watch",
    method: "POST",

    parameters: [
      {
        name: "url",
        type: "string",
        required: true,
        description: "HTTP or HTTPS URL to monitor."
      },
      {
        name: "checkType",
        type: "string",
        required: true,
        allowedValues: [
          "status",
          "content",
          "schema",
          "latency"
        ],
        description: "Monitoring mode."
      },
      {
        name: "intervalMinutes",
        type: "number",
        required: false,
        default: 5,
        description: "Polling interval."
      },
      {
        name: "threshold",
        type: "number",
        required: false,
        description: "Optional status or latency threshold."
      },
      {
        name: "webhookUrl",
        type: "string",
        required: false,
        description: "Webhook that receives alerts."
      }
    ],

    exampleRequest: {
      url: "https://api.github.com",
      checkType: "status",
      intervalMinutes: 5
    },

    exampleResponse: {
      target: {
        id: "abc123",
        status: "watching"
      }
    }
  });
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
