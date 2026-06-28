import type { ExtractionResult } from "../ai/provider.ts";
import type { ComplianceResult } from "../compliance/checker.ts";
import { getSpec } from "../compliance/rules.ts";
import { getRetriever, type Passage } from "./index.ts";

// Main narrative text of a report, used to bias retrieval toward the right topic.
function narrative(ex: ExtractionResult): string {
  return [
    ex.fields.observation,
    ex.fields.incident_description,
    ex.fields.what_happened,
    ex.fields.hse_reference,
    ex.rawText,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);
}

export type EnrichResult = {
  relevantClauses: Passage[];
  groundedSummary: string | null;
};

// Attaches real Aramco clause text (RAG) to each finding, computes the report's
// overall relevant clauses, and asks the AI for a grounded summary that uses
// BOTH the shortlist rules and the retrieved passages.
export async function enrichWithRag(
  extraction: ExtractionResult,
  compliance: ComplianceResult,
  reviewer?: {
    review?: (input: any) => Promise<string | null>;
  },
): Promise<EnrichResult> {
  const r = getRetriever();
  if (!r.available) return { relevantClauses: [], groundedSummary: null };

  const main = narrative(extraction);

  // 1) Per-finding evidence: the actual clause wording behind each gap. Query by
  //    the clause + field ONLY (no report narrative) so evidence resolves to the
  //    finding's own clause document rather than the report's subject matter.
  for (const f of compliance.findings) {
    const passages = r.retrieve(`${f.clause} ${f.field}`, 1, 1);
    if (passages.length) f.evidence = passages;
  }

  // 2) Overall relevant clauses for the report.
  const relevantClauses = r.retrieve(`${compliance.reportTitle} ${main}`, 4, 1);

  // 3) Grounded AI summary fed BOTH shortlist + RAG passages.
  let groundedSummary: string | null = null;
  const spec = getSpec(extraction.reportType);
  if (reviewer?.review) {
    groundedSummary = await reviewer.review({
      reportTitle: compliance.reportTitle,
      fields: extraction.fields,
      shortlist: spec ? spec.requiredFields.map((x) => ({ label: x.label, clause: x.clause })) : [],
      findings: compliance.findings.map((f) => ({ field: f.field, issue: f.issue, clause: f.clause })),
      passages: relevantClauses.map((p) => ({ clause: p.clause, source: p.source, excerpt: p.excerpt })),
    });
  }

  return { relevantClauses, groundedSummary };
}
