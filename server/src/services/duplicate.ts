import { db } from "../db/db.ts";
import type { ExtractionResult } from "./ai/provider.ts";

export type DuplicateCheck = {
  isDuplicate: boolean;
  duplicateOfId: number | null;
  message: string | null;
};

// Normalize text for content comparison: lowercase, drop the mock [ref ..] tag,
// strip punctuation, collapse whitespace.
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\[ref [^\]]*\]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Content key per the agreed rule: observation + location + category + risk.
// Deliberately IGNORES date, reporter/submitter and status (the "non-critical"
// fields) — so the same finding re-dated or re-submitted is caught as a duplicate.
function contentKey(observation: string, location: string, category: string, risk: string): string {
  return [norm(observation), norm(location), norm(category), norm(risk)].join(" | ");
}

// Content-based duplicate check against the stored observation data (seed + prior
// accepted submissions). Two reports are duplicates if observation+location+
// category+risk match, regardless of date or who submitted them.
export function checkDuplicate(extraction: ExtractionResult): DuplicateCheck {
  const rec = extraction.riskRecord;
  if (!rec || !rec.observation || norm(rec.observation).length < 8) {
    return { isDuplicate: false, duplicateOfId: null, message: null };
  }

  const key = contentKey(rec.observation, rec.location ?? "", rec.category ?? "", rec.risk ?? "");

  // Narrow candidates by location (indexed) when available, else scan recent rows.
  const candidates = rec.location
    ? (db
        .prepare(
          `SELECT id, observation, location, category, risk, date_open, reported_by
           FROM observations WHERE lower(COALESCE(location,'')) = lower(?)`,
        )
        .all(rec.location) as any[])
    : (db
        .prepare(
          `SELECT id, observation, location, category, risk, date_open, reported_by
           FROM observations ORDER BY id DESC LIMIT 1000`,
        )
        .all() as any[]);

  for (const c of candidates) {
    const ck = contentKey(c.observation ?? "", c.location ?? "", c.category ?? "", c.risk ?? "");
    if (ck === key) {
      const where = c.location ? ` at ${c.location}` : "";
      const when = c.date_open ? ` (originally recorded ${c.date_open})` : "";
      return {
        isDuplicate: true,
        duplicateOfId: c.id,
        message:
          `This report matches an existing record${where}${when}: same observation, category and risk level. ` +
          `Only non-critical details (date / submitter) differ. Logged as a duplicate — not added to the data.`,
      };
    }
  }

  return { isDuplicate: false, duplicateOfId: null, message: null };
}
