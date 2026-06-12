// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

export async function join(
  id: string,
  secret: string,
  lat: number,
  lng: number,
): Promise<void> {
  await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, secret, lat, lng }),
  });
}

export async function poll(id: string, secret: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ id, secret }),
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  secret: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId, secret, toId, type, payload }),
  });
}

// Fire-and-forget leave that survives the tab closing.
export function leave(id: string, secret: string): void {
  const body = JSON.stringify({ id, secret });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
