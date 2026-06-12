import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;

export const MAX_JSON_BODY_BYTES = 80 * 1024;

export interface SessionAuth {
  id: string;
  secret: string;
}

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

export function isValidSecret(secret: unknown): secret is string {
  return typeof secret === "string" && SECRET_RE.test(secret);
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifySecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || request.headers.get("x-real-ip") || "unknown";
}

export function rejectLargeBody(request: NextRequest): Response | null {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_JSON_BODY_BYTES) {
    return Response.json({ error: "body too large" }, { status: 413 });
  }
  return null;
}

export async function requirePresenceAuth(
  id: unknown,
  secret: unknown,
): Promise<
  | { ok: true; presence: { id: string; secretHash: string; peerId: string | null; pendingPeerId: string | null; busy: boolean } }
  | { ok: false; response: Response }
> {
  if (!isValidSessionId(id) || !isValidSecret(secret)) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const presence = await prisma.presence.findUnique({
    where: { id },
    select: {
      id: true,
      secretHash: true,
      peerId: true,
      pendingPeerId: true,
      busy: true,
    },
  });

  if (!presence || !verifySecret(secret, presence.secretHash)) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, presence };
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.resetAt <= now) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        resetAt: new Date(now.getTime() + windowMs),
      },
      update: {
        count: 1,
        resetAt: new Date(now.getTime() + windowMs),
      },
    });
    return true;
  }

  if (existing.count >= limit) return false;

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return true;
}
