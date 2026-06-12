import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import {
  consumeRateLimit,
  rejectLargeBody,
  requirePresenceAuth,
} from "@/lib/security";
import type { PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const largeBody = rejectLargeBody(request);
  if (largeBody) return largeBody;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, secret } = (body ?? {}) as Record<string, unknown>;
  const auth = await requirePresenceAuth(id, secret);
  if (!auth.ok) return auth.response;

  const allowed = await consumeRateLimit(`poll:${auth.presence.id}`, 80, 60_000);
  if (!allowed) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // Heartbeat
  await prisma.presence.update({
    where: { id: auth.presence.id },
    data: { lastSeen: new Date(now) },
  });

  // Cleanup stale records and free peers whose partner disappeared.
  const stalePresences = await prisma.presence.findMany({
    where: { lastSeen: { lt: staleCutoff } },
    select: { id: true },
  });
  const staleIds = stalePresences.map((presence) => presence.id);
  if (staleIds.length > 0) {
    await prisma.presence.updateMany({
      where: {
        OR: [
          { peerId: { in: staleIds } },
          { pendingPeerId: { in: staleIds } },
        ],
      },
      data: { busy: false, peerId: null, pendingPeerId: null },
    });
    await prisma.presence.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  await prisma.signal.deleteMany({
    where: { createdAt: { lt: signalCutoff } },
  });

  // Get online peers
  const peers = await prisma.presence.findMany({
    where: {
      id: { not: auth.presence.id },
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
    where: { toId: auth.presence.id },
    orderBy: { createdAt: "asc" },
  });

  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: {
        id: {
          in: inbox.map((signal) => signal.id),
        },
      },
    });
  }

  const response: PollResponse = {
    peers: peers.map((peer) => ({
      id: peer.id,
      lat: peer.lat,
      lng: peer.lng,
      busy: peer.busy,
    })),
    signals: inbox.map((signal) => ({
      id: signal.id,
      fromId: signal.fromId,
      toId: signal.toId,
      type: signal.type as PollResponse["signals"][number]["type"],
      payload: signal.payload,
      createdAt: signal.createdAt.toISOString(),
    })),
  };

  return Response.json(response);
}
