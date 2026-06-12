import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  rejectLargeBody,
  requirePresenceAuth,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id, secret }. Removes the presence row and any pending
// signals to/from this user. Called via navigator.sendBeacon on tab close, so
// the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  const largeBody = rejectLargeBody(request);
  if (largeBody) return largeBody;

  let id: string | undefined;
  let secret: string | undefined;
  try {
    const text = await request.text();
    const body = text ? JSON.parse(text) : undefined;
    id = body?.id as string | undefined;
    secret = body?.secret as string | undefined;
  } catch {
    id = undefined;
    secret = undefined;
  }

  const auth = await requirePresenceAuth(id, secret);
  if (!auth.ok) return auth.response;

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: auth.presence.id }, { fromId: auth.presence.id }] },
  });
  await prisma.presence.updateMany({
    where: {
      OR: [
        { peerId: auth.presence.id },
        { pendingPeerId: auth.presence.id },
      ],
    },
    data: { busy: false, peerId: null, pendingPeerId: null },
  });
  await prisma.presence.deleteMany({ where: { id: auth.presence.id } });

  return Response.json({ ok: true });
}
