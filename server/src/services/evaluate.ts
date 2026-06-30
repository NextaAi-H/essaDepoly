import type { ExtractionResult } from "./ai/provider.ts";
import { getAiProvider } from "./ai/index.ts";
import { getRetriever, type Passage } from "./rag/index.ts";
import { checkCompliance } from "./compliance/checker.ts";

export type EvaluatedFinding = {
  field: string;
  issue: string;
  clause: string;
  clauseTitle?: string;
  evidence?: Passage[];
};

export type Evaluation = {
  reportLabel: string;
  verdict: "ACCEPTED" | "NOT_ACCEPTED";
  complianceScore: number;
  summary: string | null;
  findings: EvaluatedFinding[];
  recommendations: string[];
  relevantClauses: Passage[];
  mode: "rules-first" | "fallback-template";
};

type GateFinding = { field: string; issue: string; clause: string };

// Deterministic compliance gate — concrete, machine-checkable GI violations applied
// to the extracted record ON TOP of the AI judge. Kept deterministic (not left to the
// model) so these specific breaches are caught reliably and CANNOT drift into
// over-rejecting complete reports the way a strengthened judge prompt does.
// Scoped to field reports only — never an informational record (monthly stats / MoM)
// or a reference plan, which legitimately have no per-finding corrective action.
function complianceGate(extraction: ExtractionResult, documentKind: string | undefined): GateFinding[] {
  if (documentKind !== "field_report") return [];
  const rr = extraction.riskRecord;
  const blank = (v: string | null | undefined) => !v || v.trim().length < 2;
  const out: GateFinding[] = [];

  // GI 6.006 (Loss Prevention Compliance Review): a substantive medium/high-risk
  // finding MUST carry a corrective action. A real hazard recorded with no corrective
  // action is an unclosed compliance gap — a documented violation, not just a hint.
  const hazard = !blank(rr.observation) && (rr.observation as string).trim().length > 15;
  if (hazard && blank(rr.corrective_action) && (rr.risk === "high" || rr.risk === "medium")) {
    out.push({
      field: "Corrective Action",
      issue:
        "A medium/high-risk finding is recorded with no corrective action. GI 6.006 (Loss Prevention " +
        "Compliance Review) requires a corrective action to be documented before a finding is accepted.",
      clause: "GI 6.006",
    });
  }
  return out;
}

// Rules-first evaluation: judge ANY report against the GI rulebook (RAG + AI),
// regardless of whether we have its template. Falls back to the deterministic
// template checker only if the AI judge is unavailable.
export async function evaluateReport(extraction: ExtractionResult): Promise<Evaluation> {
  const r = getRetriever();
  const provider = getAiProvider();

  const content =
    (extraction.rawText && extraction.rawText.length > 20
      ? extraction.rawText
      : Object.values(extraction.fields).filter(Boolean).join(" · ")) || "";

  const query = `${extraction.reportType} ${content}`.slice(0, 600);
  const relevantClauses = r.available ? r.retrieve(query, 6, 1) : [];

  const judged = provider.judge
    ? await provider.judge({
        reportContent: content,
        detectedType: extraction.reportType,
        passages: relevantClauses.map((p) => ({ clause: p.clause, source: p.source, excerpt: p.excerpt })),
      })
    : null;

  if (!judged) {
    // Safety net: deterministic template check (only meaningful for known types).
    const c = checkCompliance(extraction);
    return {
      reportLabel: c.reportTitle,
      verdict: c.verdict,
      complianceScore: c.complianceScore,
      summary: null,
      findings: c.findings,
      recommendations: c.recommendations,
      relevantClauses,
      mode: "fallback-template",
    };
  }

  // Split by severity: only "must-fix" issues drive a rejection; "recommended"
  // ones become suggestions so a genuinely complete report can be ACCEPTED.
  const mustFix = judged.findings.filter((f) => f.severity === "must-fix");
  const recommended = judged.findings.filter((f) => f.severity !== "must-fix");

  // Add deterministic GI-violation findings (machine-checked, scoped to field reports).
  const gate = complianceGate(extraction, judged.documentKind);
  const allMustFix: GateFinding[] = [...mustFix, ...gate];

  // Attach the real clause text behind each must-fix finding.
  const findings: EvaluatedFinding[] = allMustFix.map((f) => {
    const ev = r.available && (f.clause || f.field) ? r.retrieve(`${f.clause} ${f.field}`, 1, 1) : [];
    return { field: f.field, issue: f.issue, clause: f.clause, evidence: ev.length ? ev : undefined };
  });

  const verdict = allMustFix.length === 0 ? "ACCEPTED" : "NOT_ACCEPTED";
  const complianceScore =
    verdict === "ACCEPTED"
      ? Math.max(85, 100 - recommended.length * 3)
      : Math.max(0, 100 - allMustFix.length * 20 - recommended.length * 3);

  const recommendations = [
    ...recommended.map((f) => `${f.field}: ${f.issue}${f.clause ? ` (${f.clause})` : ""}`),
    ...judged.recommendations,
  ];

  return {
    reportLabel: judged.reportLabel,
    verdict,
    complianceScore,
    summary: judged.summary,
    findings,
    recommendations,
    relevantClauses,
    mode: "rules-first",
  };
}
