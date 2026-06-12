import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import type { PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");

  if (!id) {
    return Response.json({ error: "missing id" }, { status: 400 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // Heartbeat
  await prisma.presence
    .update({
      where: { id },
      data: { lastSeen: new Date(now) },
    })
    .catch(() => {});

  // Cleanup stale records
  await prisma.presence.deleteMany({
    where: { lastSeen: { lt: staleCutoff } },
  });

  await prisma.signal.deleteMany({
    where: { createdAt: { lt: signalCutoff } },
  });

  // Get online peers
  const peers = await prisma.presence.findMany({
    where: {
      id: { not: id },
      lastSeen: { gte: staleCutoff },
    },
    select: {
      id: true,
      lat: true,
      lng: true,
      busy: true,
    },
  });

  // Get inbox
  const inbox = await prisma.signal.findMany({
    where: { toId: id },
    orderBy: { createdAt: "asc" },
  });

  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: {
        id: {
          in: inbox.map((s: any) => s.id),
        },
      },
    });
  }

  const response: PollResponse = {
    peers: peers.map((p: any) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
    })),
    signals: inbox.map((s: any) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return Response.json(response);
}