import type { ExtractionResult } from "../ai/provider.ts";
import type { Passage } from "../rag/retriever.ts";
import { findClause } from "../../knowledge/aramco-clauses.ts";
import { getSpec } from "./rules.ts";

export type Finding = {
  field: string;
  issue: string;
  clause: string;       // e.g. "GI 6.000 Supplement 4"
  clauseTitle?: string;
  evidence?: Passage[]; // real clause text retrieved by RAG (added in enrichment)
};

export type Recommendation = string;

export type ComplianceResult = {
  reportType: ExtractionResult["reportType"];
  reportTitle: string;
  verdict: "ACCEPTED" | "NOT_ACCEPTED";
  complianceScore: number;        // 0..100
  findings: Finding[];
  recommendations: Recommendation[];
};

function isBlank(v: string | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "n/a" || s === "na" || s === "-" || s === "none" || s === "null";
}

export function checkCompliance(extraction: ExtractionResult): ComplianceResult {
  const spec = getSpec(extraction.reportType);

  if (!spec) {
    return {
      reportType: extraction.reportType,
      reportTitle: "Unrecognized report",
      verdict: "NOT_ACCEPTED",
      complianceScore: 0,
      findings: [
        {
          field: "report_type",
          issue:
            "Could not recognize this as a supported HSE report (Observation Log, 24-Hour Initial Report, or Investigation Status Report).",
          clause: "GI 6.000 (Incident Notification, Reporting & Investigation)",
        },
      ],
      recommendations: [
        "Re-capture the full report in good lighting so all sections are legible, or upload the original file.",
      ],
    };
  }

  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  for (const rule of spec.requiredFields) {
    const value = extraction.fields[rule.key];

    if (isBlank(value)) {
      findings.push({
        field: rule.label,
        issue: `${rule.label} is missing or blank — required by ${rule.clause}.`,
        clause: rule.clause,
      });
      recommendations.push(`Complete the "${rule.label}" field and re-submit.`);
      continue;
    }

    if (rule.validate) {
      const err = rule.validate(String(value));
      if (err) {
        findings.push({ field: rule.label, issue: err, clause: rule.clause });
        recommendations.push(`Correct the "${rule.label}" field: ${err}`);
      }
    }
  }

  // Enrich findings with the matched clause title where we can resolve one.
  for (const f of findings) {
    const c = findClause(f.clause, f.field, extraction.fields.observation, extraction.fields.hse_reference);
    if (c && c.code !== "CSM") f.clauseTitle = `${c.code} — ${c.title}`;
  }

  const required = spec.requiredFields.length;
  const failed = findings.length;
  const complianceScore = Math.max(0, Math.round(((required - failed) / required) * 100));
  const verdict = failed === 0 ? "ACCEPTED" : "NOT_ACCEPTED";

  if (verdict === "ACCEPTED") {
    recommendations.push("Report is complete and compliant — no action required.");
  }

  return {
    reportType: extraction.reportType,
    reportTitle: spec.title,
    verdict,
    complianceScore,
    findings,
    recommendations,
  };
}
