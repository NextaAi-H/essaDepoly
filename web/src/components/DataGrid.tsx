import { useEffect, useState } from "react";
import { api, type Facets, type Observation } from "../api.ts";
import EditObservationModal from "./EditObservationModal.tsx";

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
                    <button
                      onClick={() => setEditing(r)}
                      title="Edit this observation"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand border border-brand/30 rounded-lg px-2 py-1 hover:bg-brand hover:text-white transition-colors whitespace-nowrap"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditObservationModal obs={editing} onClose={() => setEditing(null)} onSaved={(u) => { applyEdit(u); setEditing(null); }} />}

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

