import { Router } from "express";
import { db } from "../db/db.ts";

export const observationsRouter = Router();

observationsRouter.get("/", (req, res) => {
  const { status, risk, week, location, q, limit = "100", offset = "0" } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: any[] = [];

  if (status) { where.push("status = ?"); params.push(status); }
  if (risk) { where.push("risk = ?"); params.push(risk); }
  if (week) { where.push("week = ?"); params.push(Number(week)); }
  if (location) { where.push("location = ?"); params.push(location); }
  if (q) { where.push("(observation LIKE ? OR recommendation LIKE ? OR hse_reference LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) c FROM observations ${clause}`).get(...params) as any).c;

  // Whitelisted sorting for the data grid.
  const SORTABLE = new Set([
    "id", "week", "sno", "observation", "status", "risk", "category", "type",
    "location", "hse_reference", "reported_by", "date_open", "date_closed", "origin",
  ]);
  const { sortBy = "week", sortDir = "desc" } = req.query as Record<string, string>;
  const col = SORTABLE.has(sortBy) ? sortBy : "week";
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  const rows = db
    .prepare(`SELECT * FROM observations ${clause} ORDER BY ${col} ${dir}, sno ASC LIMIT ? OFFSET ?`)
    .all(...params, Math.min(Number(limit), 500), Number(offset));

  res.json({ total, rows });
});

// Edit (correct/tamper) an observation. Only whitelisted columns can change.
const EDITABLE = new Set([
  "observation", "recommendation", "corrective_action", "status", "risk", "category",
  "type", "location", "hse_reference", "reported_by", "date_open", "date_closed",
]);

observationsRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const body = (req.body ?? {}) as Record<string, any>;
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (!EDITABLE.has(k)) continue;
    sets.push(`${k} = ?`);
    params.push(v === "" ? null : v);
  }
  if (sets.length === 0) return res.status(400).json({ error: "No editable fields provided." });

  const info = db.prepare(`UPDATE observations SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  if (info.changes === 0) return res.status(404).json({ error: "Observation not found." });

  const row = db.prepare("SELECT * FROM observations WHERE id = ?").get(id);
  res.json(row);
});

// Distinct values for filter dropdowns in the grid.
observationsRouter.get("/facets", (_req, res) => {
  const distinct = (col: string) =>
    (db.prepare(`SELECT DISTINCT ${col} v FROM observations WHERE ${col} IS NOT NULL AND TRIM(${col})<>'' ORDER BY ${col}`).all() as any[])
      .map((r) => r.v);
  res.json({
    risk: distinct("risk"),
    status: distinct("status"),
    category: distinct("category"),
    type: distinct("type"),
    location: distinct("location"),
  });
});
