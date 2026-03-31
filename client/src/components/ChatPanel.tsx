import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

function parseSseBlocks(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { events: parts, rest };
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = useCallback(async () => {
      const text = input.trim();
      if (!text || busy) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantId = crypto.randomUUID();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setInput("");
      setBusy(true);

      const historyForApi = [...messages, userMsg].map(({ role, content }) => ({
        role,
        content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        const reader = res.body?.getReader();
        const dec = new TextDecoder();
        if (!reader) throw new Error("No response body");
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const { events, rest } = parseSseBlocks(buf);
          buf = rest;
          for (const block of events) {
            const line = block.trim();
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            try {
              const ev = JSON.parse(raw) as {
                type: string;
                text?: string;
                message?: string;
              };
              if (ev.type === "token" && ev.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + ev.text }
                      : m,
                  ),
                );
              }
              if (ev.type === "error") {
                const errLine = ev.message ?? "unknown error";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + `\n\n[Error] ${errLine}` }
                      : m,
                  ),
                );
              }
            } catch {
              /* ignore partial JSON */
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `[Error] ${msg}` } : m,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [input, busy, messages],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-sm text-zinc-500">
            Type a message — the reply appears below it.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[min(100%,28rem)] rounded-2xl rounded-br-md bg-emerald-900/35 px-4 py-2.5 text-sm text-zinc-100 ring-1 ring-emerald-700/30"
                    : "max-w-[min(100%,28rem)] rounded-2xl rounded-bl-md bg-zinc-800/80 px-4 py-2.5 text-sm text-zinc-200 ring-1 ring-zinc-700/50"
                }
              >
                {m.role === "assistant" && m.content === "" && busy ? (
                  <span className="text-zinc-500">…</span>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex shrink-0 gap-2 border-t border-zinc-800 bg-zinc-950 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/85"
      >
        <textarea
          value={input}
          onChange={(ev) => setInput(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
              ev.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Message…"
          disabled={busy}
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 self-end rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
