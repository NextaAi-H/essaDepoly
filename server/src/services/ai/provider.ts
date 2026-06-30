export type ReportType =
  | "observation_log"
  | "24h_initial_report"
  | "investigation_status"
  | "unknown";

// A normalized "risk record" — the report distilled into one HSE observation row,
// matching the shape of the historical observation logs. Lets any accepted report
// become a dashboard observation and powers content-based duplicate detection.
export type RiskRecord = {
  observation: string | null;
  recommendation: string | null;
  corrective_action: string | null;
  risk: "low" | "medium" | "high" | null;
  category: string | null;
  location: string | null;
  hse_reference: string | null;
  reported_by: string | null;
  date: string | null;
};

// The AI engine reads a report image/text and returns a normalized extraction.
// `fields` maps canonical field keys (defined in compliance/rules.ts) to the value
// found on the report, or null when the field is blank/absent.
export type ExtractionResult = {
  reportType: ReportType;
  fields: Record<string, string | null>;
  riskRecord: RiskRecord;
  reporter: string | null;
  location: string | null;
  date: string | null;
  rawText: string;
};

export type AiInput = {
  // Single uploaded image.
  imageBase64?: string;
  mimeType?: string;
  // Text-based PDF/Word: extracted text.
  text?: string;
  // Multiple page images (e.g. a scanned PDF rendered page-by-page for OCR).
  images?: string[]; // base64 PNG data (no data: prefix)
};

// Input for the grounded compliance review: the AI receives BOTH the curated
// shortlist rules AND the real Aramco clause passages retrieved by RAG.
export type ReviewInput = {
  reportTitle: string;
  fields: Record<string, string | null>;
  shortlist: { label: string; clause: string }[];
  findings: { field: string; issue: string; clause: string }[];
  passages: { clause: string; source: string; excerpt: string }[];
};

// Rules-first judging: the AI decides accept/reject for ANY report by reasoning
// over the retrieved Saudi Aramco GI clause passages — no template field-rules.
export type JudgeInput = {
  reportContent: string;
  detectedType: string;
  passages: { clause: string; source: string; excerpt: string }[];
};

export type JudgeFinding = {
  field: string;
  issue: string;
  clause: string;
  severity: "must-fix" | "recommended";
};

export type JudgeResult = {
  reportLabel: string;            // what the AI thinks the report is
  documentKind?: string;          // field_report | plan_or_program | informational | unreadable
  verdict: "ACCEPTED" | "NOT_ACCEPTED";
  complianceScore: number;        // 0..100
  summary: string;
  findings: JudgeFinding[];
  recommendations: string[];
};

export interface AiProvider {
  name: string;
  extract(input: AiInput): Promise<ExtractionResult>;
  // Optional: produce a short natural-language assessment grounded in the
  // shortlist + retrieved clause text. Returns null if unavailable.
  review?(input: ReviewInput): Promise<string | null>;
  // Optional: rules-first verdict grounded in retrieved GI passages.
  judge?(input: JudgeInput): Promise<JudgeResult | null>;
}
