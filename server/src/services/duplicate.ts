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

// Word-set Jaccard similarity of two observation texts (0..1). Used so a report
// stays a duplicate even when the wording shifts slightly (e.g. an AI summary of
// a document, or a re-worded entry) — not only on an exact text match.
function obsSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
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
    // Exact content-key match, OR same location+category+risk with a highly
    // similar observation (≥ 0.7 word overlap) to absorb minor wording shifts.
    const ck = contentKey(c.observation ?? "", c.location ?? "", c.category ?? "", c.risk ?? "");
    const sameContext =
      norm(c.location ?? "") === norm(rec.location ?? "") &&
      norm(c.category ?? "") === norm(rec.category ?? "") &&
      norm(c.risk ?? "") === norm(rec.risk ?? "");
    const isDup = ck === key || (sameContext && obsSimilarity(rec.observation ?? "", c.observation ?? "") >= 0.7);
    if (isDup) {
      const where = c.location ? ` at ${c.location}` : "";
      const when = c.date_open ? ` (originally recorded ${c.date_open})` : "";
      return {
        isDuplicate: true,
        duplicateOfId: c.id,
        message:
          `This report matches an existing record${where}${when}: same observation, category and risk level. ` +
          `Only non-critical details (date / submitter / wording) differ. Logged as a duplicate — not added to the data.`,
      };
    }
  }

  // Also catch re-submissions of the SAME document by comparing the full extracted
  // text against recent submissions. Robust for documents the AI summarizes (where
  // the per-field risk record can vary run-to-run) — e.g. the same report with a
  // field or header edited still reads as ~identical text.
  const rawWords = norm(extraction.rawText ?? "").split(" ").filter((w) => w.length > 2);
  if (rawWords.length >= 30) {
    const reports = db
      .prepare("SELECT id, ocr_text FROM reports WHERE ocr_text IS NOT NULL ORDER BY id DESC LIMIT 200")
      .all() as any[];
    for (const r of reports) {
      if (obsSimilarity(extraction.rawText ?? "", r.ocr_text ?? "") >= 0.8) {
        return {
          isDuplicate: true,
          duplicateOfId: null,
          message:
            `This report's content is essentially identical to a previously submitted report (report #${r.id}); ` +
            `only minor details (e.g. a header or field) differ. Logged as a duplicate — not added to the data.`,
        };
      }
    }
  }

  return { isDuplicate: false, duplicateOfId: null, message: null };
}
