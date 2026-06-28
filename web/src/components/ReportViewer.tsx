import { useEffect, useState } from "react";
import { api } from "../api.ts";

const BADGE: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  NOT_ACCEPTED: "bg-rose-100 text-rose-700",
  DUPLICATE_DETECTED: "bg-amber-100 text-amber-700",
};

// Shows the ORIGINAL submitted report (the uploaded file + its verdict/insight),
// opened from an observation in the data grid or a project — not just the log.
export default function ReportViewer({ reportId, onClose }: { reportId: number; onClose: () => void }) {
  const [rep, setRep] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.report(reportId).then(setRep).catch((e) => setErr(e.message));
  }, [reportId]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Original report <span className="text-slate-400">#{reportId}</span></h3>
          <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {err && <p className="text-rose-600 text-sm">{err}</p>}
          {!rep && !err && <p className="text-slate-400 text-sm">Loading…</p>}
          {rep && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${BADGE[rep.verdict] ?? "bg-slate-100"}`}>{String(rep.verdict).replace(/_/g, " ")}</span>
                <span className="text-slate-500">{rep.report_type}</span>
                {rep.created_at && <span className="text-slate-400 text-xs">· {rep.created_at.slice(0, 16).replace("T", " ")}</span>}
              </div>
              {rep.ai_summary && <p className="text-sm text-slate-700">{rep.ai_summary}</p>}

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5">The report that was submitted</div>
                {rep.file_kind === "image" ? (
                  <img src={rep.file_path} alt="original report"
                    className="rounded-xl border border-slate-200 max-h-[55vh] w-auto"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : (
                  <a href={rep.file_path} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-brand border border-brand/30 rounded-lg px-3 py-2 hover:bg-brand hover:text-white">
                    📄 Open {rep.original_filename ?? "file"}
                  </a>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">
                  <a href={rep.file_path} target="_blank" rel="noreferrer" className="underline">Open original in a new tab</a>
                </p>
              </div>

              {Array.isArray(rep.findings) && rep.findings.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Findings</div>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {rep.findings.map((f: any, i: number) => (
                      <li key={i}>• {f.issue} {f.clause && <span className="text-[11px] text-brand">[{f.clause}]</span>}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
