import { useEffect, useState } from "react";
import { api, type Submission } from "../api.ts";

const BADGE: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  NOT_ACCEPTED: "bg-rose-100 text-rose-700",
  DUPLICATE_DETECTED: "bg-amber-100 text-amber-700",
};

export default function SubmissionLog() {
  const [rows, setRows] = useState<(Submission & { ai_summary?: string; stored_in_data?: number })[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => { api.submissions().then(setRows as any).catch(() => {}); }, []);

  const shown = filter ? rows.filter((r) => r.verdict === filter) : rows;

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-3">
        <div className="flex gap-2 items-center text-sm">
          <span className="text-slate-400">Filter:</span>
          {["", "ACCEPTED", "NOT_ACCEPTED", "DUPLICATE_DETECTED"].map((v) => (
            <button key={v || "all"} onClick={() => setFilter(v)}
              className={`px-2.5 py-1 rounded-lg border ${filter === v ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"}`}>
              {v ? v.replace(/_/g, " ") : "All"}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">When</th><th className="px-3 py-2">Verdict</th><th className="px-3 py-2">In data?</th><th className="px-3 py-2">Reporter</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => api.report(r.id).then(setDetail)}>
                    <td className="px-3 py-2 text-slate-400">{r.id}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.created_at?.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${BADGE[r.verdict] ?? "bg-slate-100"}`}>{r.verdict.replace(/_/g, " ")}</span></td>
                    <td className="px-3 py-2 text-xs">{r.stored_in_data ? <span className="text-emerald-600">added</span> : <span className="text-slate-400">log only</span>}</td>
                    <td className="px-3 py-2 text-slate-600">{r.reporter ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {rows.length === 0 && <p className="text-sm text-slate-400">No submissions yet. Submit a report to populate the log.</p>}
      </div>

      <div className="lg:col-span-2">
        {detail ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 sticky top-4">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${BADGE[detail.verdict] ?? "bg-slate-100"}`}>{detail.verdict.replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-400">#{detail.id} · score {detail.compliance_score}</span>
            </div>
            {detail.ai_summary && <p className="text-sm text-slate-700">{detail.ai_summary}</p>}
            {detail.file_path && detail.file_kind === "image" && (
              <img src={detail.file_path} alt="report" className="rounded-lg border border-slate-200 max-h-52" />
            )}
            {detail.findings?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Must-fix</div>
                <ul className="text-sm space-y-1">
                  {detail.findings.map((f: any, i: number) => (
                    <li key={i} className="text-slate-700">• {f.issue} <span className="text-[11px] text-brand">[{f.clause}]</span></li>
                  ))}
                </ul>
              </div>
            )}
            {detail.recommendations?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">What to do</div>
                <ul className="text-sm space-y-1 list-disc pl-5 text-slate-700">
                  {detail.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
            Select a submission to see its details, AI insight and the report image.
          </div>
        )}
      </div>
    </div>
  );
}
