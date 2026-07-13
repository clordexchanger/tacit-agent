import { NextRequest, NextResponse } from "next/server";
import { buildOkxAuthHeaders } from "./okxAuth";

const FACILITATOR_BASE = "https://web3.okx.com";
const FACILITATOR_PATH_PREFIX = "/api/v6/pay/x402";
const NETWORK = "eip155:196"; // X Layer, per OKX Onchain OS docs

// NOTE: confirm decimals for USDG against current OKX docs before charging real
// amounts — this assumes 6, which is standard for stablecoins but not verified here.
const USDG_DECIMALS = 6;
const USDG_ASSET =
  process.env.USDG_ASSET_ADDRESS || "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8";

function priceToAmount(priceUsd: number): string {
  return Math.round(priceUsd * 10 ** USDG_DECIMALS).toString();
}

interface X402Options {
  priceUsd: number;
  description: string;
}

export function withX402(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: X402Options
) {
  return async function (req: NextRequest): Promise<NextResponse> {
    const payTo = process.env.X402_PAY_TO_ADDRESS;
    if (!payTo) {
      return NextResponse.json(
        { error: "Server misconfigured: X402_PAY_TO_ADDRESS not set" },
        { status: 500 }
      );
    }

    const paymentRequirements = {
      scheme: "exact",
      network: NETWORK,
      amount: priceToAmount(options.priceUsd),
      asset: USDG_ASSET,
      payTo,
      maxTimeoutSeconds: 60,
      extra: { name: "USDG", version: "2" },
    };

    const paymentHeader = req.headers.get("x-payment");

    if (!paymentHeader) {
      return NextResponse.json(
        {
          x402Version: 2,
          accepts: [paymentRequirements],
          error: "Payment required",
          description: options.description,
        },
        { status: 402 }
      );
    }

    let paymentPayload: unknown;
    try {
      paymentPayload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
    } catch {
      return NextResponse.json({ error: "Malformed X-PAYMENT header" }, { status: 400 });
    }

    // Verify the payment authorization with OKX's facilitator before doing any work.
    const verifyPath = `${FACILITATOR_PATH_PREFIX}/verify`;
    const verifyBody = JSON.stringify({ paymentPayload, paymentRequirements });
    const verifyRes = await fetch(`${FACILITATOR_BASE}${verifyPath}`, {
      method: "POST",
      headers: buildOkxAuthHeaders("POST", verifyPath, verifyBody),
      body: verifyBody,
    });
    const verifyJson = await verifyRes.json();

    if (verifyJson.code !== "0" || !verifyJson.data?.isValid) {
      return NextResponse.json(
        {
          error: "Payment verification failed",
          detail: verifyJson.data?.invalidReason ?? verifyJson.msg,
        },
        { status: 402 }
      );
    }

    // Payment is valid — actually run the underlying endpoint logic.
    const response = await handler(req);

    // Only settle (charge) if the real work succeeded. Failed requests aren't billed.
    if (response.status < 400) {
      const settlePath = `${FACILITATOR_PATH_PREFIX}/settle`;
      const settleBody = JSON.stringify({ paymentPayload, paymentRequirements });
      const settleRes = await fetch(`${FACILITATOR_BASE}${settlePath}`, {
        method: "POST",
        headers: buildOkxAuthHeaders("POST", settlePath, settleBody),
        body: settleBody,
      });
      const settleJson = await settleRes.json();
      response.headers.set("X-PAYMENT-RESPONSE", JSON.stringify(settleJson.data ?? {}));
    }

    return response;
  };
}
