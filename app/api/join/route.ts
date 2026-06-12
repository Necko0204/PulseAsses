import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import {
  consumeRateLimit,
  getClientKey,
  hashSecret,
  isValidSecret,
  isValidSessionId,
  rejectLargeBody,
  verifySecret,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, secret, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and upserts the presence row. Raw
// coordinates are never stored.
export async function POST(request: NextRequest) {
  const largeBody = rejectLargeBody(request);
  if (largeBody) return largeBody;

  const allowed = await consumeRateLimit(
    `join:${getClientKey(request)}`,
    30,
    60_000,
  );
  if (!allowed) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, secret, lat, lng } = (body ?? {}) as Record<string, unknown>;

  if (!isValidSessionId(id) || !isValidSecret(secret)) {
    return Response.json({ error: "invalid session" }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const existing = await prisma.presence.findUnique({
    where: { id },
    select: { secretHash: true },
  });
  if (existing && !verifySecret(secret, existing.secretHash)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const secretHash = hashSecret(secret);

  await prisma.presence.upsert({
    where: { id },
    create: {
      id,
      secretHash,
      lat: offset.lat,
      lng: offset.lng,
      busy: false,
      lastSeen: new Date(),
    },
    update: {
      lat: offset.lat,
      lng: offset.lng,
      lastSeen: new Date(),
    },
  });

  return Response.json({ ok: true });
}
