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

  // Attach the real clause text behind each must-fix finding.
  const findings: EvaluatedFinding[] = mustFix.map((f) => {
    const ev = r.available && (f.clause || f.field) ? r.retrieve(`${f.clause} ${f.field}`, 1, 1) : [];
    return { ...f, evidence: ev.length ? ev : undefined };
  });

  const verdict = mustFix.length === 0 ? "ACCEPTED" : "NOT_ACCEPTED";
  const complianceScore =
    verdict === "ACCEPTED"
      ? Math.max(85, 100 - recommended.length * 3)
      : Math.max(0, 100 - mustFix.length * 20 - recommended.length * 3);

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
