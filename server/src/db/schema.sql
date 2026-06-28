-- HSE pilot schema

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week INTEGER,
  sno INTEGER,
  observation TEXT,
  recommendation TEXT,
  corrective_action TEXT,
  time_frame TEXT,
  date_open TEXT,
  date_closed TEXT,
  status TEXT,              -- normalized: open | closed
  responsible TEXT,
  action_taken_by TEXT,
  type TEXT,
  category TEXT,
  risk TEXT,                -- normalized: low | medium | high
  source TEXT,
  location TEXT,
  hse_reference TEXT,
  reported_by TEXT,
  source_file TEXT,
  origin TEXT DEFAULT 'seed',     -- seed | submission
  report_id INTEGER,              -- links a submitted observation back to its report log entry
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_obs_week ON observations(week);
CREATE INDEX IF NOT EXISTS idx_obs_status ON observations(status);
CREATE INDEX IF NOT EXISTS idx_obs_risk ON observations(risk);
CREATE INDEX IF NOT EXISTS idx_obs_location ON observations(location);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  report_type TEXT,                 -- observation_log | 24h_initial_report | investigation_status | unknown
  original_filename TEXT,
  file_path TEXT,
  file_kind TEXT,                   -- image | pdf | word
  ocr_text TEXT,
  extracted_json TEXT,
  verdict TEXT,                     -- ACCEPTED | NOT_ACCEPTED | DUPLICATE_DETECTED
  findings_json TEXT,
  recommendations_json TEXT,
  compliance_score INTEGER,
  duplicate_of_id INTEGER,
  content_hash TEXT,
  reporter TEXT,
  location TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_hash ON reports(content_hash);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
