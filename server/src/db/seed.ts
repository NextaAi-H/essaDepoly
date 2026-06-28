import "dotenv/config";
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { db, initSchema } from "./db.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLIENT_DATA_DIR =
  process.env.CLIENT_DATA_DIR ??
  "C:\\Users\\potato\\Desktop\\Camera\\NewFilesFinalWithemail\\Fw_ Waseet Technology (AI) Solutions";

// Column positions (A..Q) per the confirmed file structure. Mapping by index is
// safer than by header text because header P contains a literal newline.
const COL = {
  sno: 0,
  observation: 1,
  recommendation: 2,
  corrective_action: 3,
  time_frame: 4,
  date_open: 5,
  date_closed: 6,
  status: 7,
  responsible: 8,
  action_taken_by: 9,
  type: 10,
  category: 11,
  risk: 12,
  source: 13,
  location: 14,
  hse_reference: 15,
  reported_by: 16,
} as const;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  // Excel serial number
  if (typeof v === "number" && v > 0) {
    const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
    if (d && !isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(v));
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normalizeStatus(raw: unknown, dateClosed: string | null): "open" | "closed" {
  const s = clean(raw)?.toLowerCase() ?? "";
  // Formula text (e.g. "=IF(...)") or empty → infer from close date.
  if (!s || s.startsWith("=") || s.includes("if(")) {
    return dateClosed ? "closed" : "open";
  }
  if (s.includes("close")) return "closed";
  if (s.includes("open")) return "open";
  return dateClosed ? "closed" : "open";
}

function normalizeRisk(raw: unknown): string | null {
  const s = clean(raw)?.toLowerCase() ?? "";
  if (!s) return null;
  if (s.startsWith("h")) return "high";
  if (s.startsWith("m")) return "medium";
  if (s.startsWith("l")) return "low";
  return null;
}

function weekFromFilename(name: string): number | null {
  const m = name.match(/week\s*0*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function seed() {
  mkdirSync(join(__dirname, "..", "..", "data"), { recursive: true });
  initSchema();

  db.exec("DELETE FROM observations;");

  const files = readdirSync(CLIENT_DATA_DIR)
    .filter((f) => /observation tracking/i.test(f) && /\.xlsx$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`No observation tracking xlsx files found in:\n  ${CLIENT_DATA_DIR}`);
    process.exit(1);
  }

  const insert = db.prepare(`
    INSERT INTO observations (
      week, sno, observation, recommendation, corrective_action, time_frame,
      date_open, date_closed, status, responsible, action_taken_by, type,
      category, risk, source, location, hse_reference, reported_by, source_file
    ) VALUES (
      @week, @sno, @observation, @recommendation, @corrective_action, @time_frame,
      @date_open, @date_closed, @status, @responsible, @action_taken_by, @type,
      @category, @risk, @source, @location, @hse_reference, @reported_by, @source_file
    )
  `);

  let total = 0;
  const perWeek: Record<string, number> = {};

  const insertMany = db.transaction((rows: any[]) => {
    for (const r of rows) insert.run(r);
  });

  for (const file of files) {
    const week = weekFromFilename(file);
    const wb = XLSX.readFile(join(CLIENT_DATA_DIR, file), { cellDates: true });
    const ws = wb.Sheets["Sheet1"] ?? wb.Sheets[wb.SheetNames[0]];
    // header row is row 5 (index 4); data starts row 6. range:4 makes row 5 the header.
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
      header: 1,
      range: 4,
      blankrows: false,
      raw: true,
      defval: null,
    });

    const dataRows = rows.slice(1); // drop the header row
    const batch: any[] = [];

    for (const row of dataRows) {
      const observation = clean(row[COL.observation]);
      const snoRaw = row[COL.sno];
      // Valid record: has observation text and an integer SNO. This skips the
      // title banner and the orphaned =SUM() footer rows (no observation text).
      if (!observation) continue;
      const sno = typeof snoRaw === "number" ? snoRaw : Number(clean(snoRaw));
      if (!Number.isFinite(sno)) continue;

      const dateClosed = toISODate(row[COL.date_closed]);
      batch.push({
        week,
        sno,
        observation,
        recommendation: clean(row[COL.recommendation]),
        corrective_action: clean(row[COL.corrective_action]),
        time_frame: clean(row[COL.time_frame]),
        date_open: toISODate(row[COL.date_open]),
        date_closed: dateClosed,
        status: normalizeStatus(row[COL.status], dateClosed),
        responsible: clean(row[COL.responsible]),
        action_taken_by: clean(row[COL.action_taken_by]),
        type: clean(row[COL.type]),
        category: clean(row[COL.category]),
        risk: normalizeRisk(row[COL.risk]),
        source: clean(row[COL.source]),
        location: clean(row[COL.location]),
        hse_reference: clean(row[COL.hse_reference]),
        reported_by: clean(row[COL.reported_by]),
        source_file: file,
      });
    }

    insertMany(batch);
    perWeek[file] = batch.length;
    total += batch.length;
  }

  console.log("Imported observations per file:");
  for (const [f, n] of Object.entries(perWeek)) {
    console.log(`  ${String(n).padStart(4)}  ${f}`);
  }
  console.log(`\nTotal observations imported: ${total} from ${files.length} files.`);
}

seed();
