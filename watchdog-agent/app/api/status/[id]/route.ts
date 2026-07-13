import { NextRequest, NextResponse } from "next/server";
import { getTarget, getEvents } from "@/lib/kv";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const target = await getTarget(params.id);
  if (!target) {
    return NextResponse.json({ error: "target not found" }, { status: 404 });
  }
  const events = await getEvents(params.id);
  return NextResponse.json({ target, events });
}
