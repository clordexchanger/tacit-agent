import { NextResponse } from "next/server";
import { listTargets, getLastSnapshot, saveSnapshot, saveTarget, logEvent, bumpStat } from "@/lib/kv";
import { takeSnapshot, diffSnapshots } from "@/lib/diff";
import { dispatchAlert } from "@/lib/alert";

// Vercel Cron hits this route on the schedule set in vercel.json.
// Protect it so only the cron (or you, with the secret) can trigger checks.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const targets = await listTargets();
  const now = Date.now();
  const results = [];

  for (const target of targets) {
    const dueAt = (target.lastCheckedAt ?? 0) + target.intervalMinutes * 60_000;
    if (now < dueAt) continue;

    const prev = await getLastSnapshot(target.id);
    const { snapshot, error } = await takeSnapshot(target);
    const events = diffSnapshots(target, prev, snapshot, error);

    await saveSnapshot(snapshot);
    await saveTarget({ ...target, lastCheckedAt: now });
    await bumpStat("totalChecks");
    if (events.length > 0) await bumpStat("totalEvents", events.length);

    for (const event of events) {
      await logEvent(event);
      await dispatchAlert(target, event);
    }

    results.push({ targetId: target.id, checked: true, eventsFired: events.length });
  }

  return NextResponse.json({ checkedAt: now, results });
}
