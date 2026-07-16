# TACIT

Tacit is an AI-powered API monitoring and observability agent that continuously tracks API health, uptime, latency, and reliability. It detects failures, performance degradation, and service disruptions in real time, enabling developers to resolve issues quickly and keep applications running smoothly. Built for automation, speed, and dependable monitoring, Tacit helps ensure your APIs stay available and performant.

Built for the OKX AI Genesis Hackathon — Software Utility category.

## Contract

**Register a target**
```
POST /api/watch
Content-Type: application/json

{
  "url": "https://api.example.com/status",
  "checkType": "content",      // "content" | "status" | "latency" | "schema"
  "intervalMinutes": 5,
  "threshold": 500,             // required for "latency" (ms) and "status" (expected code)
  "webhookUrl": "https://your-endpoint.com/alert"
}
```
Response: `{ "target": { "id": "...", ... } }`

**Check status / history**
```
GET /api/status/:id
```
Response: `{ "target": {...}, "events": [ { "changeType": "content", "oldValue": "...", "newValue": "...", "severity": "info", "timestamp": 172... } ] }`

**Alert payload** (POSTed to your `webhookUrl` when a change fires)
```json
{ "target": "https://api.example.com/status", "event": { "changeType": "content", "severity": "info", "timestamp": 172... } }
```

## Local setup

1. `npm install`
2. Create a [Vercel KV](https://vercel.com/docs/storage/vercel-kv) store and pull env vars:
   ```
   vercel link
   vercel env pull .env.local
   ```
3. Add a `CRON_SECRET` to `.env.local` (any random string) — this protects
   `/api/poll` from being triggered by anyone but your own cron.
4. `npm run dev`

## Deploy

1. `vercel deploy --prod`
2. In the Vercel dashboard, confirm the KV store is attached to the project
   and `CRON_SECRET` is set as an environment variable.
3. Vercel Cron will start hitting `/api/poll` on the schedule in `vercel.json`
   (every 5 min by default) automatically once deployed — no extra setup.

## Listing on OKX AI

1. In Cursor, install the Onchain OS skills to set up your Agentic Wallet
   and payment tooling:
   ```
   npx skills add okx/onchainos-skills
   ```
2. Sign up on the OKX Developer Portal (web3.okx.com) and create a project
   to get your API credentials.
3. Wire pricing for this ASP — either pay-per-call (one check = one charge,
   settled via x402) or a subscription tier (e.g. "$X/month to watch one
   endpoint every 5 min") for recurring usage.
4. Submit the ASP for OKX.AI listing review. It must pass review and be
   live to be a valid hackathon submission — do this a day or two before
   the deadline, not the same day.
5. Post a demo (≤90s) on X with #OKXAI, then submit the Google form with
   your ASP details + the X post link before Jul 17, 23:59 UTC.

## Demo script (90 seconds)

1. `curl -X POST /api/watch` a real endpoint you control, checkType `content`.
2. Change the endpoint's response.
3. Show the webhook firing (or `GET /api/status/:id`) within one poll cycle.
