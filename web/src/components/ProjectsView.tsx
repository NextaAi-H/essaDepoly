import { useEffect, useMemo, useState } from "react";
import { api, type Observation, type Project, type Submission } from "../api.ts";
import InfoTip from "./InfoTip.tsx";
import EditObservationModal from "./EditObservationModal.tsx";
import ReportViewer from "./ReportViewer.tsx";

const RISK_BADGE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

// Small stat card for the project drill-in.
function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-xl font-bold ${tone ?? "text-slate-800"}`}>{value}</div>
    </div>
  );
}

// A labeled proportion bar (segments sum to a total width).
function MixBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label} — {s.value} ({Math.round((s.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

type SortKey = "total" | "high" | "medium" | "low" | "open";

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("high");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ observations: Observation[]; reports: Submission[] } | null>(null);
  const [editing, setEditing] = useState<Observation | null>(null);
  const [viewerId, setViewerId] = useState<number | null>(null);

  function applyEdit(u: Observation) {
    setDetail((d) => (d ? { ...d, observations: d.observations.map((o) => (o.id === u.id ? u : o)) } : d));
    setEditing(null);
  }

  useEffect(() => { api.projects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    api.project(selected).then((d) => setDetail({ observations: d.observations, reports: d.reports }));
  }, [selected]);

  const rows = useMemo(() => {
    const filtered = q ? projects.filter((p) => p.project.toLowerCase().includes(q.toLowerCase())) : projects;
    return [...filtered].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)).slice(0, 200);
  }, [projects, sortKey, q]);

  // Per-project insight stats computed from the drill-in observations.
  const stats = useMemo(() => {
    const obs = detail?.observations ?? [];
    const c = (f: (o: Observation) => boolean) => obs.filter(f).length;
    const total = obs.length;
    const high = c((o) => o.risk === "high");
    const medium = c((o) => o.risk === "medium");
    const low = c((o) => o.risk === "low");
    const open = c((o) => o.status === "open");
    const closed = c((o) => o.status === "closed");
    const cats: Record<string, number> = {};
    for (const o of obs) if (o.category) cats[o.category] = (cats[o.category] ?? 0) + 1;
    const topCategories = Object.entries(cats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { total, high, medium, low, open, closed, closeRate: total ? Math.round((closed / total) * 100) : 0, topCategories };
  }, [detail]);

  if (selected && detail) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-sm text-brand">&larr; All projects</button>
        <h2 className="text-lg font-bold text-slate-800">{selected}</h2>
        <div className="text-sm text-slate-500">{detail.observations.length} risks · {detail.reports.length} submitted reports</div>

        {/* ── Project insight cards ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          <Stat label="Total risks" value={stats.total} />
          <Stat label="High" value={stats.high} tone="text-rose-600" />
          <Stat label="Medium" value={stats.medium} tone="text-amber-600" />
          <Stat label="Low" value={stats.low} tone="text-emerald-600" />
          <Stat label="Open" value={stats.open} tone="text-amber-600" />
          <Stat label="Closed %" value={`${stats.closeRate}%`} tone="text-emerald-600" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <h3 className="font-semibold text-slate-800 text-sm">Risk &amp; status mix</h3>
              <InfoTip text="The top bar shows this project's risks split by severity (high/medium/low). The bottom bar shows how many are still open vs closed." />
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">By risk level</div>
                <MixBar segments={[
                  { label: "High", value: stats.high, color: "#e11d48" },
                  { label: "Medium", value: stats.medium, color: "#f59e0b" },
                  { label: "Low", value: stats.low, color: "#10b981" },
                ]} />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">By status</div>
                <MixBar segments={[
                  { label: "Closed", value: stats.closed, color: "#10b981" },
                  { label: "Open", value: stats.open, color: "#f59e0b" },
                ]} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <h3 className="font-semibold text-slate-800 text-sm">Top categories at this project</h3>
              <InfoTip text="The most common types of safety finding recorded at this project — where to focus prevention." />
            </div>
            {stats.topCategories.length === 0 ? (
              <p className="text-sm text-slate-400">No category data.</p>
            ) : (
              <div className="space-y-2">
                {stats.topCategories.map((c) => (
                  <div key={c.name} className="text-sm">
                    <div className="flex justify-between text-slate-600"><span className="truncate pr-2">{c.name}</span><span>{c.count}</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${(c.count / stats.topCategories[0].count) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 font-semibold text-slate-700 text-sm border-b border-slate-100">Risks at this project</div>
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr><th className="px-3 py-2">Observation</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Clause</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {detail.observations.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-3 py-2 max-w-md">{o.observation}{o.origin === "submission" && o.report_id && (
                      <button onClick={() => setViewerId(o.report_id)}
                        className="ml-1 text-[10px] bg-brand/10 text-brand rounded px-1 hover:bg-brand hover:text-white"
                        title="View the original submitted report">📄 view report</button>
                    )}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{o.category ?? "—"}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${RISK_BADGE[o.risk] ?? "bg-slate-100"}`}>{o.risk ?? "—"}</span></td>
                    <td className="px-3 py-2 text-slate-600">{o.status}</td>
                    <td className="px-3 py-2 text-xs text-brand whitespace-nowrap">{o.hse_reference ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setEditing(o)}
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

        {detail.reports.length > 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="font-semibold text-slate-700 text-sm mb-2">Reports submitted for this project</div>
            <ul className="text-sm space-y-1">
              {detail.reports.map((r) => (
                <li key={r.id} className="flex gap-3">
                  <span className="text-slate-400">#{r.id}</span>
                  <span className="font-medium">{r.verdict.replace(/_/g, " ")}</span>
                  <span className="text-slate-500">{r.report_type}</span>
                  <span className="text-slate-400 text-xs">{r.created_at?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {editing && <EditObservationModal obs={editing} onClose={() => setEditing(null)} onSaved={applyEdit} />}
        {viewerId && <ReportViewer reportId={viewerId} onClose={() => setViewerId(null)} />}
      </div>
    );
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSortKey(k)}
      className={`px-3 py-1.5 rounded-lg text-sm border ${sortKey === k ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px]" />
        <span className="text-xs text-slate-400">Sort by:</span>
        <SortBtn k="total" label="Most risks" />
        <SortBtn k="high" label="Most high" />
        <SortBtn k="medium" label="Most medium" />
        <SortBtn k="low" label="Most low" />
        <SortBtn k="open" label="Most open" />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[62vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Project (site)</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">High</th>
                <th className="px-3 py-2 text-right">Medium</th>
                <th className="px-3 py-2 text-right">Low</th>
                <th className="px-3 py-2 text-right">Open</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.project} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(p.project)}>
                  <td className="px-3 py-2 font-medium text-slate-800">{p.project}</td>
                  <td className="px-3 py-2 text-right">{p.total}</td>
                  <td className="px-3 py-2 text-right text-rose-600 font-medium">{p.high}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{p.medium}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{p.low}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{p.open}</td>
                  <td className="px-3 py-2 text-right text-brand text-xs">view →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-400">{projects.length} projects total · click a row to see its risks and reports</p>
    </div>
  );
}
