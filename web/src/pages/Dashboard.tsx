import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type DashboardStats, type HighRisk, type Submission } from "../api.ts";
import KpiCard from "../components/KpiCard.tsx";
import DataGrid from "../components/DataGrid.tsx";
import ProjectsView from "../components/ProjectsView.tsx";
import SubmissionLog from "../components/SubmissionLog.tsx";
import Assistant from "../components/Assistant.tsx";
import InfoTip from "../components/InfoTip.tsx";

const RISK_COLORS: Record<string, string> = {
  high: "#e11d48",
  medium: "#f59e0b",
  low: "#10b981",
  unspecified: "#94a3b8",
};
const BRAND = "#0f766e";

function Panel({
  title,
  description,
  info,
  children,
}: {
  title: string;
  description?: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          {info && <InfoTip text={info} />}
        </div>
        {description && <p className="text-xs text-slate-400 mt-0.5 leading-snug">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const GRID = "#eef2f6";
const AXIS_TICK = { fontSize: 11, fill: "#64748b" };

// Consistent tooltip styling across all charts.
const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
} as const;

// Axis label helper (recharts <Label> via the `label` prop).
const xLabel = (value: string) => ({ value, position: "insideBottom" as const, offset: -2, fontSize: 11, fill: "#94a3b8" });
const yLabel = (value: string) => ({ value, angle: -90 as const, position: "insideLeft" as const, fontSize: 11, fill: "#94a3b8" });

// Render the percentage INSIDE each donut slice so labels never clip the panel.
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (!percent || percent < 0.05) return null; // hide tiny slices
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#fff" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="central">
      {Math.round(percent * 100)}%
    </text>
  );
}

const VERDICT_BADGE: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  NOT_ACCEPTED: "bg-rose-100 text-rose-700",
  DUPLICATE_DETECTED: "bg-amber-100 text-amber-700",
};

function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [highRisk, setHighRisk] = useState<HighRisk[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.highRisk(), api.submissions()])
      .then(([s, h, u]) => { setStats(s); setHighRisk(h); setSubs(u); })
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="text-rose-600">Failed to load dashboard: {err}</div>;
  if (!stats) return <div className="text-slate-500 py-20 text-center">Loading dashboard…</div>;

  const k = stats.kpis;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">HSE Manager Dashboard</h1>
        <p className="text-sm text-slate-500">
          {k.totalObservations.toLocaleString()} observations across 22 weeks · Al-Essa sites
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Observations" value={k.totalObservations.toLocaleString()} />
        <KpiCard label="Open" value={k.open.toLocaleString()} tone="warn" />
        <KpiCard label="Closed" value={k.closed.toLocaleString()} tone="good" sub={`${k.closeRate}% close rate`} />
        <KpiCard label="High-risk open" value={k.highRiskOpen.toLocaleString()} tone="danger" sub="needs attention" />
        <KpiCard label="Submissions" value={k.submissions} sub="AI-scanned reports" />
        <KpiCard label="Acceptance" value={k.acceptanceRate === null ? "—" : `${k.acceptanceRate}%`} tone="good" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Risk distribution"
          description="Share of all observations by assessed risk level (high / medium / low)."
          info="Every observation is rated High, Medium or Low risk. This donut shows what proportion of all records fall into each level — a quick read on how severe the safety findings are overall."
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stats.byRisk}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                label={renderPieLabel}
                labelLine={false}
              >
                {stats.byRisk.map((d) => <Cell key={d.name} fill={RISK_COLORS[d.name] ?? "#64748b"} />)}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} observations`, name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value: any, entry: any) =>
                  `${value} — ${Number(entry?.payload?.value ?? 0).toLocaleString()}`
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Open vs closed by week"
          description="How many observations were open vs closed each week (weeks 1–22). Taller bars = more activity."
          info="Each bar is one week. Green = observations that have been closed out; amber = still open. Use it to spot weeks with heavy activity or a backlog of unresolved items."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.byWeek} margin={{ top: 5, right: 10, bottom: 18, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="week" tick={AXIS_TICK} tickLine={false} label={xLabel("Week number")} />
              <YAxis tick={AXIS_TICK} width={38} tickLine={false} axisLine={false} label={yLabel("Observations")} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]} labelFormatter={(l) => `Week ${l}`} />
              <Legend verticalAlign="top" iconType="circle" height={28} />
              <Bar dataKey="closed" name="Closed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" name="Open" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Most-cited Aramco clauses" description="Which GI / CSM clauses are referenced most across observations."
          info="Counts how often each Saudi Aramco clause (GI / CSM / CSSP) is cited across all observations. Tells you which standards your sites are flagged against most often.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topClauses} layout="vertical" margin={{ top: 5, right: 34, bottom: 18, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} label={xLabel("Times cited")} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} times`, "Cited"]} />
              <Bar dataKey="value" fill={BRAND} radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="value" position="right" fontSize={10} fill="#475569" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top observation categories" description="The most frequently reported types of safety findings."
          info="Groups observations by category (PPE, scaffolding, housekeeping, lifting, etc.). Shows what kinds of hazards come up most — useful for targeting training and prevention.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.byCategory} layout="vertical" margin={{ top: 5, right: 34, bottom: 18, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} label={xLabel("Observations")} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} observations`, "Count"]} />
              <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="value" position="right" fontSize={10} fill="#475569" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top sites (projects)" description="The sites/projects with the most observations logged."
          info="Ranks sites/projects by total observations logged. A high count can mean a busy site or one needing closer attention — open the Projects tab to drill in.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.byLocation} layout="vertical" margin={{ top: 5, right: 34, bottom: 18, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} label={xLabel("Observations")} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toLocaleString()} observations`, "Count"]} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="value" position="right" fontSize={10} fill="#475569" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {subs.length > 0 && (
        <Panel title="Recent AI-scanned submissions" description="Reports submitted through the tool and the verdict each received.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 text-xs uppercase">
                  <th className="py-2 pr-3">#</th><th className="pr-3">Type</th><th className="pr-3">Reporter</th>
                  <th className="pr-3">Score</th><th className="pr-3">Verdict</th><th>When</th>
                </tr>
              </thead>
              <tbody>
                {subs.slice(0, 10).map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 text-slate-500">{s.id}</td>
                    <td className="pr-3">{s.report_type}</td>
                    <td className="pr-3">{s.reporter ?? "—"}</td>
                    <td className="pr-3">{s.compliance_score}%</td>
                    <td className="pr-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${VERDICT_BADGE[s.verdict] ?? "bg-slate-100"}`}>
                        {s.verdict.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">{s.created_at.slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel
        title={`⚠️ High-risk open items (${highRisk.length})`}
        description="Observations rated High risk that are still open — the priority follow-up list."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase">
                <th className="py-2 pr-3">Wk</th><th className="pr-3">Observation</th>
                <th className="pr-3">Location</th><th className="pr-3">Clause</th><th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {highRisk.slice(0, 15).map((h) => (
                <tr key={h.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-500">{h.week}</td>
                  <td className="pr-3 max-w-md">{h.observation}</td>
                  <td className="pr-3 text-slate-600 whitespace-nowrap">{h.location}</td>
                  <td className="pr-3 text-xs text-brand whitespace-nowrap">{h.hse_reference}</td>
                  <td className="text-slate-400 text-xs whitespace-nowrap">{h.date_open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Compliance score by reporter"
        description="Each reporter's closure rate — the share of their observations that have been closed out."
      >
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {stats.byReporter.map((r) => (
            <div key={r.name} className="rounded-xl border border-slate-100 p-3">
              <div className="font-medium text-slate-700 truncate">{r.name}</div>
              <div className="text-xs text-slate-400">{r.total} observations</div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-brand" style={{ width: `${r.complianceScore}%` }} />
              </div>
              <div className="text-xs text-slate-500 mt-1">{r.complianceScore}% closed</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "data", label: "Data (Excel view)" },
  { key: "projects", label: "Projects" },
  { key: "log", label: "Submission Log" },
  { key: "assistant", label: "Ask AI" },
] as const;

export default function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-white text-brand-dark shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "data" && <DataGrid />}
      {tab === "projects" && <ProjectsView />}
      {tab === "log" && <SubmissionLog />}
      {tab === "assistant" && <Assistant />}
    </div>
  );
}
