import OpenAI from "openai";
import type {
  AiInput, AiProvider, ExtractionResult, JudgeInput, JudgeResult, ReportType, ReviewInput,
} from "./provider.ts";
import { REPORT_SPECS } from "../compliance/rules.ts";

const REPORT_TYPES: ReportType[] = [
  "observation_log",
  "24h_initial_report",
  "investigation_status",
  "unknown",
];

function fieldGuide(): string {
  return Object.values(REPORT_SPECS)
    .map((spec) => {
      const keys = spec.requiredFields.map((f) => `      - ${f.key}: ${f.label}`).join("\n");
      return `  ${spec.type} (${spec.title}):\n${keys}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are an HSE (Health, Safety & Environment) compliance assistant for a Saudi Aramco contractor.
You read a photographed or scanned HSE report and extract its content as structured JSON.

Supported report types and the canonical fields to extract for each:
${fieldGuide()}

Rules:
- Identify "reportType" as one of: ${REPORT_TYPES.join(", ")}.
- Populate "fields" using ONLY the canonical keys listed for the identified report type.
- For any field that is blank, illegible, crossed out, or absent on the report, set its value to null. Do NOT guess.
- Also return top-level "reporter", "location", and "date" when visible (else null).
- Return "rawText" with the full text you read from the document.
- ALSO return "riskRecord": the report distilled into ONE HSE observation row, with keys:
  "observation" (one concise sentence naming the hazard/finding/incident),
  "recommendation", "corrective_action", "category" (e.g. PPE, Scaffolding, Gas Testing, Housekeeping, Lifting, Fire),
  "risk" (one of "low","medium","high" — your best assessment of the hazard severity),
  "location", "hse_reference" (the GI/CSM clause it relates to), "reported_by", "date".
  Use null for anything not determinable. This must be filled for ANY report type.
- Respond with a single JSON object only, no commentary.`;

export class OpenAiProvider implements AiProvider {
  name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async extract(input: AiInput): Promise<ExtractionResult> {
    const userContent: any[] = [
      { type: "text", text: "Extract this HSE report into the required JSON structure." },
    ];
    if (input.imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${input.mimeType ?? "image/jpeg"};base64,${input.imageBase64}` },
      });
    } else if (input.images && input.images.length) {
      // Scanned-PDF pages rendered to images — OCR via vision.
      for (const b64 of input.images) {
        userContent.push({ type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } });
      }
    } else if (input.text) {
      userContent.push({ type: "text", text: `Document text:\n\n${input.text}` });
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      seed: 7, // best-effort determinism: same image → same extraction across runs
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const rr = parsed.riskRecord ?? {};
    const risk = ["low", "medium", "high"].includes(String(rr.risk).toLowerCase())
      ? (String(rr.risk).toLowerCase() as "low" | "medium" | "high")
      : null;

    return {
      reportType: REPORT_TYPES.includes(parsed.reportType) ? parsed.reportType : "unknown",
      fields: parsed.fields ?? {},
      riskRecord: {
        observation: rr.observation ?? null,
        recommendation: rr.recommendation ?? null,
        corrective_action: rr.corrective_action ?? null,
        risk,
        category: rr.category ?? null,
        location: rr.location ?? parsed.location ?? null,
        hse_reference: rr.hse_reference ?? null,
        reported_by: rr.reported_by ?? parsed.reporter ?? null,
        date: rr.date ?? parsed.date ?? null,
      },
      reporter: parsed.reporter ?? null,
      location: parsed.location ?? null,
      date: parsed.date ?? null,
      rawText: parsed.rawText ?? input.text ?? "",
    };
  }

  // Grounded review: the model is given the shortlist rules AND the retrieved
  // Aramco clause passages, and must ground its assessment in that text only.
  async review(input: ReviewInput): Promise<string | null> {
    const sys =
      "You are an HSE compliance reviewer for a Saudi Aramco contractor. " +
      "Write a brief (2-4 sentence) assessment of the report. " +
      "Ground every claim ONLY in the provided Aramco clause excerpts and the required-field rules. " +
      "Quote or cite the clause code where relevant. Do not invent clauses or requirements.";
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: JSON.stringify({
              reportTitle: input.reportTitle,
              extractedFields: input.fields,
              requiredRules: input.shortlist,
              detectedIssues: input.findings,
              aramcoClausePassages: input.passages,
            }),
          },
        ],
      });
      return completion.choices[0]?.message?.content?.trim() ?? null;
    } catch (e: any) {
      console.warn("[ai] grounded review failed:", e?.message);
      return null;
    }
  }

  async judge(input: JudgeInput): Promise<JudgeResult | null> {
    const today = new Date().toISOString().slice(0, 10);
    const sys =
`Today's date is ${today}. Treat any date on or before today as valid (NOT "in the future").

You are a fair, practical HSE document reviewer for a Saudi Aramco contractor. Your job is to decide
whether a submitted document is ACCEPTABLE for the safety records. Be reasonable, NOT pedantic — real
field paperwork is rarely perfect. Reject ONLY for concrete, safety-critical gaps you can clearly name.

STEP 1 — classify the document into one "documentKind":
- "field_report": a fillable report/permit/checklist (incident report, near-miss, observation,
  work permit, hot work, confined-space entry, JSA/inspection checklist).
- "plan_or_program": a comprehensive plan/program/policy document (CSSP, ERP/Emergency Response,
  HIP, Journey Management Plan, procedures). These are reference documents, not fill-in forms.
- "informational": a record that is not a pass/fail form (safety statistics summary, monthly stats,
  meeting minutes/MoM, attendance, employee counts, photos of boards).
- "unreadable": you genuinely cannot read enough to assess.

STEP 2 — apply the right standard:
- field_report → ACCEPTED if its CRITICAL safety fields are present and legible. must-fix ONLY for a
  clearly missing/blank/illegible CRITICAL field, e.g.: a permit with no gas test or no authorizing
  signature; an incident report with no description/date or (for an injury) no injured-person details;
  an observation with no observation text or no risk rating. Anything else → "recommended".
- plan_or_program → ACCEPTED if it is a genuine, substantially complete document covering its main
  expected sections. Do NOT fail it for individual GI sub-clauses you cannot see. must-fix ONLY if an
  ENTIRE critical section is clearly absent (e.g. an ERP with no emergency contacts at all).
- informational → ACCEPTED. It is a record, not a pass/fail form. Summarize what it is. No must-fix.
- unreadable → NOT_ACCEPTED, one finding: the document is illegible / too little content to assess.

KEY RULES:
- Use the provided Aramco clause passages as REFERENCE for good practice and for writing helpful
  recommendations — NOT as a checklist where every clause must be explicitly satisfied. NEVER fail a
  document just because a clause is not visibly addressed, unless it is a clear, critical safety gap.
- Do NOT assume something is "missing" only because OCR/extraction was partial. If unsure whether a
  field is present, treat it as a "recommended" note, not a must-fix.
- BIAS TOWARD ACCEPTED for legitimate, legible, substantially-complete documents. Reserve NOT_ACCEPTED
  for real critical gaps you can concretely name. verdict = ACCEPTED if there are ZERO must-fix issues.

OUTPUT — in "recommendations" give clear, specific, step-by-step actions (most useful first). Make
"summary" a one-line plain-English status. Return ONLY JSON:
{"documentKind": string, "reportLabel": string, "verdict": "ACCEPTED"|"NOT_ACCEPTED",
 "complianceScore": number (0-100), "summary": string,
 "findings": [{"field": string, "issue": string, "clause": string, "severity": "must-fix"|"recommended"}],
 "recommendations": [string]}.`;
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        seed: 7, // best-effort determinism so the same report gets a stable verdict
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: JSON.stringify({
              detectedType: input.detectedType,
              reportContent: input.reportContent,
              aramcoClausePassages: input.passages,
            }),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const p = JSON.parse(raw);
      const verdict = p.verdict === "ACCEPTED" ? "ACCEPTED" : "NOT_ACCEPTED";
      return {
        reportLabel: typeof p.reportLabel === "string" ? p.reportLabel : input.detectedType,
        documentKind: typeof p.documentKind === "string" ? p.documentKind : undefined,
        verdict,
        complianceScore: Number.isFinite(p.complianceScore) ? Math.max(0, Math.min(100, p.complianceScore)) : (verdict === "ACCEPTED" ? 100 : 50),
        summary: typeof p.summary === "string" ? p.summary : "",
        findings: Array.isArray(p.findings) ? p.findings.filter((f: any) => f && f.issue).map((f: any) => ({
          field: String(f.field ?? "Issue"),
          issue: String(f.issue),
          clause: String(f.clause ?? ""),
          severity: f.severity === "must-fix" ? "must-fix" : "recommended",
        })) : [],
        recommendations: Array.isArray(p.recommendations) ? p.recommendations.map(String) : [],
      };
    } catch (e: any) {
      console.warn("[ai] judge failed:", e?.message);
      return null;
    }
  }
}
