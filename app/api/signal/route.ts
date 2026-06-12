import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumeRateLimit,
  isValidSessionId,
  rejectLargeBody,
  requirePresenceAuth,
} from "@/lib/security";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024; // SDP/ICE are small; cap to be safe.

// POST /api/signal — body { fromId, toId, type, payload? }
// Drops one message into the recipient's mailbox. Also manages the `busy`
// flag so a user can only be in one connection at a time.
export async function POST(request: NextRequest) {
  const largeBody = rejectLargeBody(request);
  if (largeBody) return largeBody;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { fromId, secret, toId, type, payload } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (!isValidSessionId(fromId) || !isValidSessionId(toId) || fromId === toId) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;
  const auth = await requirePresenceAuth(fromId, secret);
  if (!auth.ok) return auth.response;

  const allowed = await consumeRateLimit(`signal:${fromId}`, 120, 60_000);
  if (!allowed) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  if (!isPayloadAllowed(signalType, payloadStr)) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const pendingForTarget = await prisma.signal.count({ where: { toId } });
  if (pendingForTarget >= 100) {
    return Response.json({ error: "target mailbox full" }, { status: 429 });
  }

  // Enforce "one active connection at a time": if the target is already busy,
  // auto-decline the request instead of delivering it.
  if (signalType === "request") {
    const target = await prisma.presence.findUnique({
      where: { id: toId },
      select: { busy: true, peerId: true, pendingPeerId: true },
    });
    if (!target) {
      // Target went offline — tell the initiator it was declined.
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
    if (
      auth.presence.busy ||
      auth.presence.peerId ||
      auth.presence.pendingPeerId ||
      target.busy ||
      target.peerId ||
      target.pendingPeerId
    ) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }

    await prisma.presence.update({
      where: { id: fromId },
      data: { pendingPeerId: toId },
    });
    await prisma.presence.update({
      where: { id: toId },
      data: { pendingPeerId: fromId },
    });
    await createSignal(fromId, toId, signalType, payloadStr);
    return Response.json({ ok: true });
  }

  // Busy transitions:
  // - accept: the connection is now active → mark BOTH peers busy.
  // - decline/end: free both peers.
  if (signalType === "accept") {
    const target = await getPresenceState(toId);
    if (
      !target ||
      auth.presence.pendingPeerId !== toId ||
      target.pendingPeerId !== fromId ||
      auth.presence.peerId ||
      target.peerId
    ) {
      return Response.json({ error: "invalid connection state" }, { status: 409 });
    }

    await prisma.presence.update({
      where: { id: fromId },
      data: { busy: true, peerId: toId, pendingPeerId: null },
    });
    await prisma.presence.update({
      where: { id: toId },
      data: { busy: true, peerId: fromId, pendingPeerId: null },
    });
    await createSignal(fromId, toId, signalType, payloadStr);
    return Response.json({ ok: true });
  }

  if (signalType === "decline") {
    const target = await getPresenceState(toId);
    if (
      auth.presence.pendingPeerId !== toId &&
      target?.pendingPeerId !== fromId
    ) {
      return Response.json({ error: "invalid connection state" }, { status: 409 });
    }

    await clearPending(fromId, toId);
    await createSignal(fromId, toId, signalType, payloadStr);
    return Response.json({ ok: true });
  }

  if (signalType === "end") {
    const target = await getPresenceState(toId);
    const isActivePair = auth.presence.peerId === toId && target?.peerId === fromId;
    const isPendingPair =
      auth.presence.pendingPeerId === toId && target?.pendingPeerId === fromId;
    if (!isActivePair && !isPendingPair) {
      return Response.json({ error: "invalid connection state" }, { status: 409 });
    }

    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: false, peerId: null, pendingPeerId: null },
    });
    await createSignal(fromId, toId, signalType, payloadStr);
    return Response.json({ ok: true });
  }

  const target = await getPresenceState(toId);
  if (auth.presence.peerId !== toId || target?.peerId !== fromId) {
    return Response.json({ error: "invalid connection state" }, { status: 409 });
  }

  await createSignal(fromId, toId, signalType, payloadStr);

  return Response.json({ ok: true });
}

// Helper: deliver an auto-decline from `target` back to `initiator`.
async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: { fromId: targetId, toId: initiatorId, type: "decline", payload: null },
  });
}

async function createSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload: string | null,
) {
  await prisma.signal.create({
    data: { fromId, toId, type, payload },
  });
}

async function getPresenceState(id: string) {
  return prisma.presence.findUnique({
    where: { id },
    select: { busy: true, peerId: true, pendingPeerId: true },
  });
}

async function clearPending(fromId: string, toId: string) {
  await prisma.presence.updateMany({
    where: { id: { in: [fromId, toId] } },
    data: { pendingPeerId: null },
  });
}

function isPayloadAllowed(type: SignalType, payload: string | null): boolean {
  if (type === "request" || type === "accept" || type === "decline" || type === "end") {
    return payload === null;
  }

  if (!payload) return false;

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (type === "ice") return typeof parsed.candidate === "string";
    return parsed.type === type && typeof parsed.sdp === "string";
  } catch {
    return false;
  }
}
