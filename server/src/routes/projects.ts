import { Router } from "express";
import { db } from "../db/db.ts";

export const projectsRouter = Router();

// Projects = the Location/site field. Each project's "risks" are its observations.
// Returns counts per project (total / high / medium / low / open / closed) so the
// UI can sort by whichever matters.
projectsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT
         location AS project,
         COUNT(*) AS total,
         SUM(CASE WHEN risk='high' THEN 1 ELSE 0 END)   AS high,
         SUM(CASE WHEN risk='medium' THEN 1 ELSE 0 END) AS medium,
         SUM(CASE WHEN risk='low' THEN 1 ELSE 0 END)    AS low,
         SUM(CASE WHEN status='open' THEN 1 ELSE 0 END)   AS open,
         SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed,
         SUM(CASE WHEN origin='submission' THEN 1 ELSE 0 END) AS submitted
       FROM observations
       WHERE location IS NOT NULL AND TRIM(location) <> ''
       GROUP BY location
       ORDER BY total DESC`,
    )
    .all();
  res.json(rows);
});

// One project: its risks (observations) + the reports submitted against it (log).
projectsRouter.get("/:name", (req, res) => {
  const name = req.params.name;
  const observations = db
    .prepare(
      `SELECT id, week, observation, recommendation, corrective_action, status, date_open,
              date_closed, type, category, risk, source, hse_reference, reported_by, origin
       FROM observations WHERE lower(location) = lower(?) ORDER BY risk='high' DESC, id DESC`,
    )
    .all(name);

  const reports = db
    .prepare(
      `SELECT id, created_at, report_type, verdict, compliance_score, reporter, stored_in_data
       FROM reports WHERE lower(COALESCE(location,'')) = lower(?) ORDER BY id DESC`,
    )
    .all(name);

  res.json({ project: name, observations, reports });
});
