export default function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "danger" | "good" | "warn";
}) {
  const tones = {
    default: "text-slate-800",
    danger: "text-rose-600",
    good: "text-emerald-600",
    warn: "text-amber-600",
  } as const;
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
