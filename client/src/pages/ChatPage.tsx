import { ChatPanel } from "../components/ChatPanel.js";

export function ChatPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] min-h-0 w-full max-w-3xl flex-col px-4 pt-3 pb-4">
      <div className="mb-2 shrink-0">
        <p className="text-xs font-medium tracking-wide text-emerald-400/90">Chat</p>
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Messages and model replies
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm">
        <ChatPanel />
      </div>
    </div>
  );
}
