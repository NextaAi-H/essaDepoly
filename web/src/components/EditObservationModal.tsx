import { useState } from "react";
import { api, type Observation } from "../api.ts";

// Reusable edit dialog for an observation — used by the Data grid and the
// Projects drill-in. Lets a manager correct status/risk/dates and the text.
export default function EditObservationModal({
  obs,
  onClose,
  onSaved,
}: {
  obs: Observation;
  onClose: () => void;
  onSaved: (u: Observation) => void;
}) {
  const [form, setForm] = useState({
    status: obs.status ?? "open",
    risk: obs.risk ?? "",
    category: obs.category ?? "",
    date_open: obs.date_open ?? "",
    date_closed: obs.date_closed ?? "",
    observation: obs.observation ?? "",
    recommendation: (obs as any).recommendation ?? "",
    corrective_action: (obs as any).corrective_action ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const field = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const updated = await api.updateObservation(obs.id, form);
      onSaved(updated);
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Edit observation <span className="text-slate-400">#{obs.id}</span></h3>
          <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-500">Status
            <select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="open">open</option><option value="closed">closed</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">Risk
            <select className={field} value={form.risk} onChange={(e) => set("risk", e.target.value)}>
              <option value="">—</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">Date opened
            <input type="date" className={field} value={form.date_open} onChange={(e) => set("date_open", e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-500">Date closed
            <input type="date" className={field} value={form.date_closed} onChange={(e) => set("date_closed", e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-500 col-span-2">Category
            <input className={field} value={form.category} onChange={(e) => set("category", e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-500 col-span-2">Observation
            <textarea className={field} rows={2} value={form.observation} onChange={(e) => set("observation", e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-500 col-span-2">Recommendation
            <textarea className={field} rows={2} value={form.recommendation} onChange={(e) => set("recommendation", e.target.value)} />
          </label>
          <label className="text-xs font-medium text-slate-500 col-span-2">Corrective action
            <textarea className={field} rows={2} value={form.corrective_action} onChange={(e) => set("corrective_action", e.target.value)} />
          </label>
          {err && <p className="text-rose-600 text-sm col-span-2">{err}</p>}
        </div>

        <div className="flex gap-2 px-5 py-3.5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl bg-brand text-white font-medium hover:bg-brand-dark disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
