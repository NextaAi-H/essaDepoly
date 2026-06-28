import { useRef, useState } from "react";
import { api, type AnalyzeResult, type PreviewResult } from "../api.ts";
import ResultCard from "../components/ResultCard.tsx";

type Phase = "idle" | "ready" | "analyzing" | "confirm" | "saving" | "done" | "error";

// Read-only display of the extracted data on the confirm screen.
const FIELDS: { key: string; label: string }[] = [
  { key: "observation", label: "Observation / finding" },
  { key: "recommendation", label: "Recommendation" },
  { key: "corrective_action", label: "Corrective action" },
  { key: "risk", label: "Risk rating" },
  { key: "category", label: "Category" },
  { key: "location", label: "Location / project" },
  { key: "hse_reference", label: "HSE reference" },
  { key: "reported_by", label: "Reported by" },
  { key: "date", label: "Date" },
];

export default function Submit() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setPhase("ready");
  }

  async function analyze() {
    if (!file) return;
    setPhase("analyzing");
    setError(null);
    try {
      const p = await api.preview(file);
      setPreview(p);
      const isAcceptable = p.verdict === "ACCEPTED" && !p.duplicate;
      if (isAcceptable) {
        // Accepted → let the user review (read-only) and decide to Submit or Cancel.
        setPhase("confirm");
      } else {
        // Rejected or duplicate → log automatically, never stored in the data.
        setPhase("saving");
        setResult(await api.commit(p));
        setPhase("done");
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
      setPhase("error");
    }
  }

  async function submitAccepted() {
    if (!preview) return;
    setPhase("saving");
    try {
      setResult(await api.commit(preview));
      setPhase("done");
    } catch (e: any) {
      setError(e.message ?? "Save failed.");
      setPhase("error");
    }
  }

  function reset() {
    setFile(null); setPreviewUrl(null); setPreview(null); setResult(null); setError(null);
    setPhase("idle");
  }

  return (
    <div className="max-w-xl mx-auto">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx" hidden
        onChange={(e) => pick(e.target.files?.[0] ?? null)} />

      {phase === "idle" && (
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Submit an HSE Report</h1>
          <p className="text-slate-500 mt-1 mb-6 text-sm">
            Take a photo of the filled report, or upload a scan / PDF / Word file. The AI reads it and
            checks it against Saudi Aramco standards.
          </p>
          <div className="grid gap-3">
            <button onClick={() => cameraRef.current?.click()}
              className="py-6 rounded-2xl bg-brand text-white font-semibold text-lg shadow hover:bg-brand-dark transition-colors">
              📷 Take a Photo
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-brand transition-colors">
              📎 Upload a file (image / PDF / Word)
            </button>
          </div>
        </div>
      )}

      {phase === "ready" && file && (
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Ready to analyze</h2>
          {previewUrl ? (
            <img src={previewUrl} alt="report preview" className="mx-auto max-h-80 rounded-xl border border-slate-200" />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">📄 {file.name}</div>
          )}
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-600">Cancel</button>
            <button onClick={analyze} className="flex-1 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark">Analyze report</button>
          </div>
        </div>
      )}

      {(phase === "analyzing" || phase === "saving") && (
        <div className="text-center py-20">
          <div className="animate-spin h-10 w-10 border-4 border-brand border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-slate-600">{phase === "analyzing" ? "Reading the report…" : "Saving…"}</p>
        </div>
      )}

      {phase === "confirm" && preview && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="font-semibold text-emerald-700">✅ This report is acceptable</div>
            <div className="text-sm text-emerald-700/80">{preview.reportTitle} · score {preview.complianceScore}</div>
            {preview.aiSummary && <div className="text-xs text-emerald-700/70 mt-1">{preview.aiSummary}</div>}
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">This is the data that will be saved</div>
            <dl className="divide-y divide-slate-100">
              {FIELDS.map((f) => (
                <div key={f.key} className="py-2 grid grid-cols-3 gap-2 text-sm">
                  <dt className="text-slate-400">{f.label}</dt>
                  <dd className={`col-span-2 ${preview.riskRecord?.[f.key] ? "text-slate-800" : "text-slate-300 italic"}`}>
                    {preview.riskRecord?.[f.key] ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Submit to store this in the data and the log. Cancel discards it — nothing is saved or logged.
          </p>
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-600">Cancel</button>
            <button onClick={submitAccepted} className="flex-1 py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark">Submit</button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="text-center py-16 space-y-4">
          <div className="text-rose-600 font-semibold">⚠️ {error}</div>
          <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-brand text-white font-medium">Try again</button>
        </div>
      )}

      {phase === "done" && result && <ResultCard result={result} onReset={reset} />}
    </div>
  );
}
