import { NextRequest, NextResponse } from "next/server";
import { x402ResourceServer, x402HTTPResourceServer } from "@okxweb3/x402-core/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import type { HTTPAdapter, HTTPRequestContext, RouteConfig } from "@okxweb3/x402-core/server";

const NETWORK = "eip155:196"; // X Layer

interface X402Options {
  priceUsd: number;
  description: string;
}

// One HTTP resource server per unique route config, initialized once and
// reused across requests (matches how the SDK's Express example wires it up
// at app-startup rather than per-request).
const serverCache = new Map<string, Promise<x402HTTPResourceServer>>();

function getHttpServer(routeKey: string, routeConfig: RouteConfig): Promise<x402HTTPResourceServer> {
  const cached = serverCache.get(routeKey);
  if (cached) return cached;

  const promise = (async () => {
    const facilitatorClient = new OKXFacilitatorClient({
      apiKey: process.env.OKX_API_KEY!,
      secretKey: process.env.OKX_SECRET_KEY!,
      passphrase: process.env.OKX_PASSPHRASE!,
    });

    const resourceServer = new x402ResourceServer(facilitatorClient).register(
      NETWORK,
      new ExactEvmScheme()
    );

    const httpServer = new x402HTTPResourceServer(resourceServer, {
      [routeKey]: routeConfig,
    });
    await httpServer.initialize();
    return httpServer;
  })();

  serverCache.set(routeKey, promise);
  return promise;
}

function buildAdapter(req: NextRequest): HTTPAdapter {
  return {
    getHeader: (name: string) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => req.nextUrl.pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get("accept") ?? "",
    getUserAgent: () => req.headers.get("user-agent") ?? "",
  };
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

    const routeKey = `${req.method} ${req.nextUrl.pathname}`;
    const routeConfig: RouteConfig = {
      accepts: {
        scheme: "exact",
        network: NETWORK,
        payTo,
        price: `$${options.priceUsd.toFixed(2)}`,
      },
      description: options.description,
      mimeType: "application/json",
    };

    const httpServer = await getHttpServer(routeKey, routeConfig);

    const context: HTTPRequestContext = {
      adapter: buildAdapter(req),
      path: req.nextUrl.pathname,
      method: req.method,
      paymentHeader:
        req.headers.get("payment-signature") ?? req.headers.get("x-payment") ?? undefined,
    };

    const result = await httpServer.processHTTPRequest(context);

    if (result.type === "payment-error") {
      const res = NextResponse.json(result.response.body ?? {}, {
        status: result.response.status,
      });
      for (const [key, value] of Object.entries(result.response.headers)) {
        res.headers.set(key, value);
      }
      return res;
    }

    // "payment-verified" — the SDK confirmed a valid payment authorization.
    // Run the real endpoint logic now.
    const response = await handler(req);

    if (result.type === "payment-verified" && response.status < 400) {
      const settleResult = await httpServer.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions
      );
      if (settleResult.success) {
        for (const [key, value] of Object.entries(settleResult.headers)) {
          response.headers.set(key, value);
        }
      }
      // If settlement itself fails after a valid verify, we still return the
      // already-completed response — verify already confirmed the payment
      // was validly authorized, so this is a rare finalization-only failure.
    }

    return response;
  };
}
