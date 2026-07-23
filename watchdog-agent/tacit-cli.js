#!/usr/bin/env node
// TACIT CLI — a small command-line client for the free demo lane.
// Requires Node 18+ (uses the built-in fetch).
//
// Usage:
//   node tacit-cli.js watch <url> [--type content|status|schema|latency] [--interval <minutes>]
//   node tacit-cli.js check <id>
//   node tacit-cli.js status <id>
//   node tacit-cli.js board
//
// Environment:
//   TACIT_BASE_URL   Override the API base URL (default: https://tacit-agent.vercel.app)

const BASE_URL = process.env.TACIT_BASE_URL || "https://tacit-agent.vercel.app";

function getFlag(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return args[i + 1];
}

async function watch(args) {
  const url = args[0];
  if (!url) {
    console.error("Usage: tacit watch <url> [--type content|status|schema|latency] [--interval <minutes>]");
    process.exit(1);
  }
  const checkType = getFlag(args, "type", "content");
  const intervalMinutes = Number(getFlag(args, "interval", "1"));

  const res = await fetch(`${BASE_URL}/api/demo-watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, checkType, intervalMinutes }),
  });
  const data = await res.json();

  if (!res.ok) {
    console.error(`Error: ${data.error || res.statusText}`);
    process.exit(1);
  }

  console.log(`Registered — id: ${data.target.id}`);
  console.log(`  url:       ${data.target.url}`);
  console.log(`  checkType: ${data.target.checkType}`);
  console.log(`\nRun a baseline check with:\n  node tacit-cli.js check ${data.target.id}`);
}

async function check(args) {
  const id = args[0];
  if (!id) {
    console.error("Usage: tacit check <id>");
    process.exit(1);
  }
  const res = await fetch(`${BASE_URL}/api/demo-watch/${id}/check`, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    console.error(`Error: ${data.error || res.statusText}`);
    process.exit(1);
  }

  console.log(
    data.eventsFired > 0
      ? `Change detected! (${data.eventsFired} event(s))`
      : "Checked — no change since last time."
  );
  console.log(`\nSee full history with:\n  node tacit-cli.js status ${id}`);
}

async function status(args) {
  const id = args[0];
  if (!id) {
    console.error("Usage: tacit status <id>");
    process.exit(1);
  }
  const res = await fetch(`${BASE_URL}/api/status/${id}`);
  const data = await res.json();

  if (!res.ok) {
    console.error(`Error: ${data.error || res.statusText}`);
    process.exit(1);
  }

  console.log(`Target: ${data.target.url} (${data.target.checkType})`);
  console.log(
    `Last checked: ${data.target.lastCheckedAt ? new Date(data.target.lastCheckedAt).toLocaleString() : "never"}`
  );
  console.log(`\nEvents (${data.events.length}):`);
  for (const ev of data.events) {
    console.log(
      `  [${new Date(ev.timestamp).toLocaleTimeString()}] ${ev.changeType}: ${ev.oldValue} -> ${ev.newValue}`
    );
  }
}

async function board() {
  const res = await fetch(`${BASE_URL}/api/demo-watch`);
  const data = await res.json();

  console.log(`Live board (${data.board.length} target(s)):\n`);
  for (const b of data.board) {
    const last = b.lastCheckedAt ? new Date(b.lastCheckedAt).toLocaleTimeString() : "never checked";
    console.log(`  ${b.id}  [${b.checkType}]  ${b.url}  — last: ${last}`);
  }
}

function printHelp() {
  console.log(`
TACIT CLI — watch anything, get told when it changes.

Usage:
  node tacit-cli.js watch <url> [--type content|status|schema|latency] [--interval <minutes>]
  node tacit-cli.js check <id>
  node tacit-cli.js status <id>
  node tacit-cli.js board

Examples:
  node tacit-cli.js watch https://api.example.com --type content
  node tacit-cli.js check 3f9a2b1c-...
  node tacit-cli.js status 3f9a2b1c-...
  node tacit-cli.js board

This CLI uses the free demo lane (rate-limited, no wallet needed).
For the paid, agent-facing API with no rate limit, see:
  ${BASE_URL}/#access

Environment:
  TACIT_BASE_URL   Override the API base URL (default: ${BASE_URL})
`);
}

async function main() {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "watch":
      await watch(rest);
      break;
    case "check":
      await check(rest);
      break;
    case "status":
      await status(rest);
      break;
    case "board":
      await board();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
