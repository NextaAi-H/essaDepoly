import type { AiInput, AiProvider, ExtractionResult, JudgeInput, JudgeResult, ReportType, ReviewInput, RiskRecord } from "./provider.ts";

// Deterministic stub so the whole app demos end-to-end without an API key.
// Picks a realistic scenario based on a hash of the input, so the same file
// always yields the same result (which also makes duplicate detection demoable).
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type Scenario = Omit<ExtractionResult, "riskRecord">;

const SCENARIOS: Scenario[] = [
  {
    reportType: "observation_log" as ReportType,
    reporter: "Tahir",
    location: "Riyadh Refinery",
    date: "2026-03-04",
    rawText: "[mock] HSE Observation Tracking Log — fully completed entry.",
    fields: {
      observation: "Worker observed without face shield while grinding.",
      recommendation: "Provide and enforce face shield use for all grinding tasks.",
      corrective_action: "Toolbox talk conducted; face shields issued same day.",
      risk: "high",
      location: "Riyadh Refinery",
      hse_reference: "CSM — PPE Requirements",
      date_open: "2026-03-04",
      reported_by: "Tahir",
    },
  },
  {
    reportType: "24h_initial_report" as ReportType,
    reporter: "M. Hussain",
    location: "ABQ Main Plant",
    date: "2026-05-12",
    rawText: "[mock] 24-Hour Initial Report — incident with incomplete sign-off.",
    fields: {
      incident_category: "Injury/Illness",
      incident_datetime: "05/12/26 14:30",
      incident_description:
        "Contractor slipped on spilled hydraulic oil near pump P-101 while transferring tools; sustained a wrist sprain.",
      injured_personnel: "Ahmed K., badge 88213, Iqama 2419..., age 34, Pakistani, ABC Contracting",
      responsible_org: "Project Construction Dept (PCD-21)",
      work_permit_required: "Yes",
      signoff_name: "M. Hussain",
      signoff_loginid: null, // missing
      signoff_date: null, // blank date field
    },
  },
  {
    reportType: "observation_log" as ReportType,
    reporter: "Sajid",
    location: "Manifa",
    date: "2026-05-24",
    rawText: "[mock] HSE Observation Tracking Log — missing corrective action & wrong risk rating.",
    fields: {
      observation: "Only one gas monitor available despite four workers in the confined area.",
      recommendation: "Provide a personal gas monitor for each worker entering the area.",
      corrective_action: null, // missing corrective action
      risk: "Severe", // invalid risk rating
      location: "Manifa",
      hse_reference: "GI 2.709 (Gas Testing Procedure)",
      date_open: "2026-05-24",
      reported_by: "Sajid",
    },
  },
];

// Primary narrative field per report type — tagged with the seed so two *different*
// uploads that land on the same scenario still read as distinct reports (avoids a
// false near-duplicate). Identical bytes still exact-match via the content hash.
const NARRATIVE_KEY: Record<string, string> = {
  observation_log: "observation",
  "24h_initial_report": "incident_description",
  investigation_status: "what_happened",
};

function deriveRiskRecord(s: Scenario): RiskRecord {
  const f = s.fields;
  const risk = ["low", "medium", "high"].includes(String(f.risk).toLowerCase())
    ? (String(f.risk).toLowerCase() as "low" | "medium" | "high")
    : "high";
  return {
    observation: f.observation ?? f.incident_description ?? s.rawText,
    recommendation: f.recommendation ?? null,
    corrective_action: f.corrective_action ?? null,
    risk,
    category: f.hse_reference?.includes("PPE") ? "PPE" : f.hse_reference?.includes("Gas") ? "Gas Testing" : "General",
    location: s.location,
    hse_reference: f.hse_reference ?? null,
    reported_by: s.reporter,
    date: s.date,
  };
}

export class MockProvider implements AiProvider {
  name = "mock";
  async extract(input: AiInput): Promise<ExtractionResult> {
    const seed = hash((input.text ?? "") + (input.imageBase64?.slice(0, 256) ?? "") + (input.mimeType ?? ""));
    const base = SCENARIOS[seed % SCENARIOS.length];
    const tag = (seed % 100000).toString(36);

    const scenario: ExtractionResult = {
      ...base,
      fields: { ...base.fields },
      rawText: `${base.rawText} (ref ${tag})`,
      riskRecord: deriveRiskRecord(base),
    };
    const nk = NARRATIVE_KEY[scenario.reportType];
    if (nk && scenario.fields[nk]) {
      scenario.fields[nk] = `${scenario.fields[nk]} [ref ${tag}]`;
    }
    scenario.riskRecord = { ...scenario.riskRecord, observation: scenario.fields[nk ?? "observation"] ?? scenario.riskRecord.observation };
    return scenario;
  }

  // Deterministic grounded summary that visibly uses BOTH the shortlist and the
  // RAG passages — so the "feed the AI both" concept is demoable without a key.
  async review(input: ReviewInput): Promise<string | null> {
    const status =
      input.findings.length === 0
        ? `The ${input.reportTitle} appears complete against all ${input.shortlist.length} required items.`
        : `The ${input.reportTitle} is missing ${input.findings.length} required item(s): ${input.findings
            .map((f) => f.field)
            .join(", ")}.`;
    const top = input.passages[0];
    const grounded = top
      ? ` Per ${top.clause} (${top.source}): "${top.excerpt.replace(/\s+/g, " ").slice(0, 200)}"`
      : "";
    return `${status}${grounded}`;
  }

  // Deterministic rules-first judge: looks for obvious completeness signals so the
  // flow works without a key. (The real reasoning happens via the OpenAI provider.)
  async judge(input: JudgeInput): Promise<JudgeResult | null> {
    const text = input.reportContent.toLowerCase();
    const has = (re: RegExp) => re.test(text);
    const findings: JudgeResult["findings"] = [];
    const top = input.passages[0];
    const clause = top?.clause ?? "GI (general)";

    if (!has(/sign|name|approved|completed by/)) {
      findings.push({ field: "Signature / Completed By", issue: "No signature or completing person identified.", clause, severity: "must-fix" });
    }
    if (!has(/\b(20\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/)) {
      findings.push({ field: "Date", issue: "No date found on the report.", clause, severity: "must-fix" });
    }
    if (!has(/correct|action|recommend|mitigat/)) {
      findings.push({ field: "Corrective Action", issue: "No corrective action or recommendation found.", clause, severity: "recommended" });
    }

    const mustFix = findings.filter((f) => f.severity === "must-fix").length;
    const verdict = mustFix === 0 ? "ACCEPTED" : "NOT_ACCEPTED";
    const score = Math.max(0, 100 - mustFix * 25 - (findings.length - mustFix) * 5);
    return {
      reportLabel: input.detectedType || "HSE Report",
      documentKind: "field_report",
      verdict,
      complianceScore: score,
      summary:
        (verdict === "ACCEPTED"
          ? "Report appears complete against the retrieved Aramco requirements."
          : `Report is missing ${findings.length} expected element(s).`) +
        (top ? ` Reference ${top.clause}: "${top.excerpt.replace(/\s+/g, " ").slice(0, 160)}"` : ""),
      findings,
      recommendations: findings.map((f) => `Add ${f.field.toLowerCase()} and re-submit.`),
    };
  }
}
