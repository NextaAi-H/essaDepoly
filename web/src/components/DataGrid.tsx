import { useEffect, useState } from "react";
import { api, type Facets, type Observation } from "../api.ts";

const COLUMNS: { key: string; label: string }[] = [
  { key: "week", label: "Wk" },
  { key: "observation", label: "Observation" },
  { key: "category", label: "Category" },
  { key: "risk", label: "Risk" },
  { key: "status", label: "Status" },
  { key: "location", label: "Location (Project)" },
  { key: "hse_reference", label: "HSE Ref" },
  { key: "reported_by", label: "Reported By" },
  { key: "date_open", label: "Opened" },
  { key: "origin", label: "Origin" },
];

const RISK_BADGE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

const PAGE = 50;

export default function DataGrid() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filters, setFilters] = useState({ risk: "", status: "", category: "", location: "", q: "" });
  const [sortBy, setSortBy] = useState("week");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; rows: Observation[] }>({ total: 0, rows: [] });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Observation | null>(null);

  function applyEdit(updated: Observation) {
    setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === updated.id ? updated : r)) }));
  }

  useEffect(() => { api.facets().then(setFacets).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    api.observations({ ...filters, sortBy, sortDir, limit: PAGE, offset })
      .then(setData)
      .finally(() => setLoading(false));
  }, [filters, sortBy, sortDir, offset]);

  function setFilter(k: string, v: string) {
    setOffset(0);
    setFilters((f) => ({ ...f, [k]: v }));
  }
  function toggleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  }

  const sel = "border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          placeholder="Search observations, recommendations, clauses…"
          value={filters.q}
          onChange={(e) => setFilter("q", e.target.value)}
          className={`${sel} flex-1 min-w-[220px]`}
        />
        <select className={sel} value={filters.risk} onChange={(e) => setFilter("risk", e.target.value)}>
          <option value="">All risk</option>
          {facets?.risk.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className={sel} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">All status</option>
          {facets?.status.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className={sel} value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">All categories</option>
          {facets?.category.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className={sel} value={filters.location} onChange={(e) => setFilter("location", e.target.value)}>
          <option value="">All projects</option>
          {facets?.location.map((v) => <option key={v}>{v}</option>)}
        </select>
        {(filters.risk || filters.status || filters.category || filters.location || filters.q) && (
          <button onClick={() => { setFilters({ risk: "", status: "", category: "", location: "", q: "" }); setOffset(0); }}
            className="text-sm text-brand underline">clear</button>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500">
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)}
                    className="px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:text-brand">
                    {c.label}{sortBy === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-400">{r.week ?? "—"}</td>
                  <td className="px-3 py-2 max-w-md">
                    {r.observation}
                    {r.origin === "submission" && <span className="ml-1 text-[10px] bg-brand/10 text-brand rounded px-1">submitted</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.category ?? "—"}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${RISK_BADGE[r.risk] ?? "bg-slate-100"}`}>{r.risk ?? "—"}</span></td>
                  <td className="px-3 py-2 text-slate-600">{r.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.location ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-brand">{r.hse_reference ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.reported_by ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-400 text-xs">{r.date_open ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{r.origin ?? "seed"}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setEditing(r)} className="text-xs text-brand hover:underline whitespace-nowrap">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditModal obs={editing} onClose={() => setEditing(null)} onSaved={(u) => { applyEdit(u); setEditing(null); }} />}

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{loading ? "Loading…" : `Showing ${data.total ? offset + 1 : 0}–${Math.min(offset + PAGE, data.total)} of ${data.total.toLocaleString()}`}</span>
        <div className="flex gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Prev</button>
          <button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ obs, onClose, onSaved }: { obs: Observation; onClose: () => void; onSaved: (u: Observation) => void }) {
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
  const field = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm";

  async function save() {
    setSaving(true); setErr(null);
    try {
      const updated = await api.updateObservation(obs.id, form);
      onSaved(updated);
    } catch (e: any) { setErr(e.message); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Edit observation #{obs.id}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-500">Status
            <select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="open">open</option><option value="closed">closed</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Risk
            <select className={field} value={form.risk} onChange={(e) => set("risk", e.target.value)}>
              <option value="">—</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Date opened
            <input type="date" className={field} value={form.date_open} onChange={(e) => set("date_open", e.target.value)} />
          </label>
          <label className="text-xs text-slate-500">Date closed
            <input type="date" className={field} value={form.date_closed} onChange={(e) => set("date_closed", e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 col-span-2">Category
            <input className={field} value={form.category} onChange={(e) => set("category", e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 col-span-2">Observation
            <textarea className={field} rows={2} value={form.observation} onChange={(e) => set("observation", e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 col-span-2">Recommendation
            <textarea className={field} rows={2} value={form.recommendation} onChange={(e) => set("recommendation", e.target.value)} />
          </label>
          <label className="text-xs text-slate-500 col-span-2">Corrective action
            <textarea className={field} rows={2} value={form.corrective_action} onChange={(e) => set("corrective_action", e.target.value)} />
          </label>
        </div>
        {err && <p className="text-rose-600 text-sm mt-2">{err}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl bg-brand text-white font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
