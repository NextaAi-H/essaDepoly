import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// DB file lives at server/data/hse.db
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "hse.db");

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

export function initSchema() {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  // Lightweight migrations for columns added after initial release.
  for (const col of ["relevant_clauses_json TEXT", "ai_summary TEXT", "stored_in_data INTEGER DEFAULT 0"]) {
    try {
      db.exec(`ALTER TABLE reports ADD COLUMN ${col};`);
    } catch {
      /* column already exists */
    }
  }
  for (const col of ["origin TEXT DEFAULT 'seed'", "report_id INTEGER", "created_at TEXT"]) {
    try {
      db.exec(`ALTER TABLE observations ADD COLUMN ${col};`);
    } catch {
      /* column already exists */
    }
  }
}

export type Observation = {
  id: number;
  week: number | null;
  sno: number | null;
  observation: string | null;
  recommendation: string | null;
  corrective_action: string | null;
  time_frame: string | null;
  date_open: string | null;
  date_closed: string | null;
  status: string | null;
  responsible: string | null;
  action_taken_by: string | null;
  type: string | null;
  category: string | null;
  risk: string | null;
  source: string | null;
  location: string | null;
  hse_reference: string | null;
  reported_by: string | null;
  source_file: string | null;
  origin: string | null;
  report_id: number | null;
  created_at: string | null;
};

export type ReportRow = {
  id: number;
  created_at: string;
  report_type: string | null;
  original_filename: string | null;
  file_path: string | null;
  file_kind: string | null;
  ocr_text: string | null;
  extracted_json: string | null;
  verdict: string | null;
  findings_json: string | null;
  recommendations_json: string | null;
  compliance_score: number | null;
  duplicate_of_id: number | null;
  content_hash: string | null;
  reporter: string | null;
  location: string | null;
};
