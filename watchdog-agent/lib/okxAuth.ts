import { createHmac } from "crypto";

// OKX's standard API auth scheme: sign = Base64(HMAC-SHA256(timestamp + method + path + body, secretKey))
export function buildOkxAuthHeaders(method: string, requestPath: string, body: string = "") {
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const sign = createHmac("sha256", process.env.OKX_SECRET_KEY!)
    .update(prehash)
    .digest("base64");

  return {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE!,
    "Content-Type": "application/json",
  };
}
