import { Router } from "express";
import { db } from "../db/db.ts";

export const dashboardRouter = Router();

const all = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as any[];
const one = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as any;

dashboardRouter.get("/stats", (_req, res) => {
  const totals = one(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN status='open' AND risk='high' THEN 1 ELSE 0 END) AS high_risk_open
    FROM observations
  `);

  const closeRate = totals.total ? Math.round((totals.closed / totals.total) * 100) : 0;

  const reportTotals = one(`
    SELECT
      COUNT(*) AS submissions,
      SUM(CASE WHEN verdict='ACCEPTED' THEN 1 ELSE 0 END) AS accepted
    FROM reports
  `);
  const acceptanceRate = reportTotals.submissions
    ? Math.round((reportTotals.accepted / reportTotals.submissions) * 100)
    : null;

  const byRisk = all(`
    SELECT COALESCE(risk,'unspecified') AS name, COUNT(*) AS value
    FROM observations GROUP BY risk ORDER BY value DESC
  `);

  const byWeek = all(`
    SELECT week,
      SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed,
      COUNT(*) AS total
    FROM observations WHERE week IS NOT NULL GROUP BY week ORDER BY week
  `);

  const byCategory = all(`
    SELECT category AS name, COUNT(*) AS value
    FROM observations WHERE category IS NOT NULL
    GROUP BY category ORDER BY value DESC LIMIT 10
  `);

  const byLocation = all(`
    SELECT location AS name, COUNT(*) AS value
    FROM observations WHERE location IS NOT NULL
    GROUP BY location ORDER BY value DESC LIMIT 10
  `);

  // Group HSE references by the leading GI / CSM / CSSP token so the chart is meaningful.
  const byClause = all(`
    SELECT hse_reference FROM observations WHERE hse_reference IS NOT NULL
  `);
  const clauseCounts: Record<string, number> = {};
  for (const r of byClause) {
    const ref = String(r.hse_reference);
    const m = ref.match(/\b(GI\s*\d+\.?\d*|CSM[^,/]*|CSSP|SAES[-\w.]*)/i);
    const key = (m ? m[1] : ref).replace(/\s+/g, " ").trim().toUpperCase();
    clauseCounts[key] = (clauseCounts[key] ?? 0) + 1;
  }
  const topClauses = Object.entries(clauseCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const byReporter = all(`
    SELECT reported_by AS name,
      COUNT(*) AS total,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed
    FROM observations WHERE reported_by IS NOT NULL
    GROUP BY reported_by ORDER BY total DESC LIMIT 8
  `).map((r) => ({
    name: r.name,
    total: r.total,
    closed: r.closed,
    complianceScore: r.total ? Math.round((r.closed / r.total) * 100) : 0,
  }));

  res.json({
    kpis: {
      totalObservations: totals.total,
      open: totals.open,
      closed: totals.closed,
      closeRate,
      highRiskOpen: totals.high_risk_open,
      submissions: reportTotals.submissions,
      acceptanceRate,
    },
    byRisk,
    byWeek,
    byCategory,
    byLocation,
    topClauses,
    byReporter,
  });
});

// Auto-flagged: open high-risk observations needing immediate attention.
dashboardRouter.get("/high-risk", (_req, res) => {
  const rows = all(`
    SELECT id, week, observation, recommendation, category, location, hse_reference, date_open, reported_by
    FROM observations
    WHERE status='open' AND risk='high'
    ORDER BY week DESC, id DESC
    LIMIT 50
  `);
  res.json(rows);
});
