import type { AnalyzeResult } from "../api.ts";

const VERDICT = {
  ACCEPTED: { label: "Accepted", emoji: "✅", ring: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700" },
  NOT_ACCEPTED: { label: "Not Accepted", emoji: "❌", ring: "border-rose-300", bg: "bg-rose-50", text: "text-rose-700" },
  DUPLICATE_DETECTED: { label: "Duplicate Detected", emoji: "🔁", ring: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700" },
} as const;

export default function ResultCard({ result, onReset }: { result: AnalyzeResult; onReset: () => void }) {
  const v = VERDICT[result.verdict];

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 ${v.ring} ${v.bg} p-5`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{v.emoji}</span>
          <div>
            <div className={`text-xl font-bold ${v.text}`}>{v.label}</div>
            <div className="text-sm text-slate-600">
              {result.reportTitle}
              {result.verdict !== "DUPLICATE_DETECTED" && ` · Compliance score ${result.complianceScore}%`}
            </div>
          </div>
        </div>
        {result.duplicate && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-100 rounded-lg p-3">{result.duplicate.message}</p>
        )}
        <p className="mt-3 text-xs text-slate-600">
          {result.addedToData
            ? `✓ Added to the data${result.project ? ` under project "${result.project}"` : ""}.`
            : "Logged in the submission log only — not added to the data."}
        </p>
      </div>

      {result.aiSummary && (
        <div className="rounded-2xl bg-brand/5 border border-brand/20 p-5">
          <h3 className="font-semibold text-brand-dark mb-1.5 text-sm flex items-center gap-2">
            🧠 AI assessment <span className="text-[10px] font-normal text-slate-500">grounded in Aramco source documents (RAG)</span>
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">{result.aiSummary}</p>
        </div>
      )}

      {result.findings.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Findings</h3>
          <ul className="space-y-2">
            {result.findings.map((f, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-rose-500 mt-0.5">•</span>
                <div className="min-w-0">
                  <div className="text-slate-800">{f.issue}</div>
                  <div className="mt-0.5 inline-block text-[11px] font-medium text-brand bg-brand/10 rounded px-1.5 py-0.5">
                    {f.clauseTitle ?? f.clause}
                  </div>
                  {f.evidence?.map((e, j) => (
                    <blockquote key={j} className="mt-1.5 border-l-2 border-slate-200 pl-2.5 text-xs text-slate-500 italic">
                      "{e.excerpt}"
                      <span className="block not-italic text-[10px] text-slate-400 mt-0.5">— {e.clause}, {e.source}</span>
                    </blockquote>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">📋 Recommendations</h3>
          <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {result.relevantClauses?.length > 0 && (
        <details className="rounded-2xl bg-white border border-slate-200 p-5" open>
          <summary className="font-semibold text-slate-800 cursor-pointer">
            Relevant Aramco clauses <span className="text-xs font-normal text-slate-400">retrieved from source documents</span>
          </summary>
          <ul className="mt-3 space-y-2.5">
            {result.relevantClauses.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="inline-block text-[11px] font-medium text-brand bg-brand/10 rounded px-1.5 py-0.5">{c.clause}</span>
                <span className="text-[11px] text-slate-400 ml-2">{c.source}</span>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">"{c.excerpt}"</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="rounded-2xl bg-white border border-slate-200 p-5">
        <summary className="font-semibold text-slate-800 cursor-pointer">What the AI read from the report</summary>
        <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {Object.entries(result.extracted).map(([k, val]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">{k.replace(/_/g, " ")}</dt>
              <dd className={val ? "text-slate-800" : "text-rose-400 italic"}>{val ?? "— blank —"}</dd>
            </div>
          ))}
        </dl>
      </details>

      <button
        onClick={onReset}
        className="w-full py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors"
      >
        Scan another report
      </button>
    </div>
  );
}
