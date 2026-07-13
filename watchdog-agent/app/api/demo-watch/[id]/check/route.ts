import { NextRequest, NextResponse } from "next/server";
import { getTarget, getLastSnapshot, saveSnapshot, saveTarget, logEvent } from "@/lib/kv";
import { takeSnapshot, diffSnapshots } from "@/lib/diff";

// Lets the web demo trigger an immediate check on its own target, for a
// live feel instead of waiting on the cron interval. Restricted to isDemo
// targets only, so this can't be used as a free way to poll paid targets.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const target = await getTarget(params.id);

  if (!target || !target.isDemo) {
    return NextResponse.json({ error: "Not a demo target" }, { status: 403 });
  }

  const prev = await getLastSnapshot(target.id);
  const { snapshot, error } = await takeSnapshot(target);
  const events = diffSnapshots(target, prev, snapshot, error);

  await saveSnapshot(snapshot);
  await saveTarget({ ...target, lastCheckedAt: Date.now() });

  for (const event of events) {
    await logEvent(event);
  }

  return NextResponse.json({ checked: true, eventsFired: events.length });
}
