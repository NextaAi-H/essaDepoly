import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which 5 projects have the most high risks?",
  "How many observations are still open vs closed?",
  "Show me the open high-risk scaffolding issues",
  "What are the most common risk categories?",
  "Which reporter logged the most observations?",
];

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await api.chat(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 flex flex-col h-[68vh]">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 text-sm">Ask the data</h3>
        <p className="text-xs text-slate-400">The assistant looks up the real observation, project and submission data to answer.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-sm mt-6">
            <p className="mb-3">Ask anything about the HSE data. For example:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-brand text-white" : "bg-slate-100 text-slate-800"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-3.5 py-2.5 text-sm text-slate-400">
              <span className="inline-block animate-pulse">Looking up the data…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 border-t border-slate-100 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about risks, projects, reports…"
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  );
}
