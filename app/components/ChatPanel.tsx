"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ChatAttachment } from "@/lib/webrtc";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text?: string;
  attachment?: ChatAttachment;
}

const MAX_ATTACHMENT_BYTES = 512 * 1024;

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onSendAttachment,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onSendAttachment: (attachment: ChatAttachment) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!connected || (!text && !attachment)) return;
    if (text) onSend(text);
    if (attachment) onSendAttachment(attachment);
    setDraft("");
    setAttachment(null);
    setAttachmentError(null);
  }

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachmentError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null);
      setAttachmentError("Attachment must be 512 KB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAttachment({
        name: file.name,
        mime: file.type || "application/octet-stream",
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => {
      setAttachment(null);
      setAttachmentError("Could not read that file.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-white/10 bg-[#07090c]/95 text-zinc-100 shadow-2xl backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 text-sm font-black text-zinc-950">
            S
          </div>
          <div>
            <p className="font-semibold leading-tight">Stranger</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={`size-2 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {connected ? "Connected" : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Video
          </button>
          <button
            onClick={onEnd}
            className="rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-400"
          >
            End
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)] p-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-8 max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-500">
            Say hello. Messages and attachments are peer-to-peer and never stored.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[82%] overflow-hidden rounded-2xl text-sm shadow-lg ${
                m.mine
                  ? "rounded-br-md bg-emerald-400 text-zinc-950 shadow-emerald-950/20"
                  : "rounded-bl-md border border-white/10 bg-zinc-900 text-zinc-100 shadow-black/20"
              }`}
            >
              {m.attachment && <AttachmentBubble attachment={m.attachment} />}
              {m.text && <p className="whitespace-pre-wrap px-3 py-2">{m.text}</p>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-white/10 bg-black/20 p-3">
        {attachment && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
            <span className="truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="rounded-full px-2 py-1 text-emerald-100 hover:bg-white/10"
            >
              Remove
            </button>
          </div>
        )}
        {attachmentError && (
          <p className="mb-2 px-1 text-xs text-red-300">{attachmentError}</p>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.txt,.md"
            className="hidden"
            onChange={chooseFile}
            disabled={!connected}
          />
          <button
            type="button"
            title="Attach photo or file"
            onClick={() => fileRef.current?.click()}
            disabled={!connected}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-40"
          >
            +
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={connected ? "Type a message…" : "Connecting…"}
            disabled={!connected}
            className="min-w-0 flex-1 rounded-full border border-white/5 bg-zinc-950 px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-400/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || (!draft.trim() && !attachment)}
            className="rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function AttachmentBubble({ attachment }: { attachment: ChatAttachment }) {
  const isImage = attachment.mime.startsWith("image/");

  if (isImage) {
    return (
      <figure>
        <Image
          src={attachment.dataUrl}
          alt={attachment.name}
          width={320}
          height={240}
          unoptimized
          className="max-h-64 w-full object-cover"
        />
        <figcaption className="truncate px-3 py-2 text-xs opacity-75">
          {attachment.name}
        </figcaption>
      </figure>
    );
  }

  return (
    <a
      href={attachment.dataUrl}
      download={attachment.name}
      className="flex items-center gap-3 px-3 py-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-xs font-bold">
        FILE
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{attachment.name}</span>
        <span className="block text-xs opacity-70">{attachment.mime}</span>
      </span>
    </a>
  );
}
