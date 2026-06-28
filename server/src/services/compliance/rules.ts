import type { ReportType } from "../ai/provider.ts";

export type FieldRule = {
  key: string;            // canonical key the AI must populate
  label: string;          // human-readable field name
  clause: string;         // Aramco clause this requirement maps to
  // Optional validator: returns an error message if the value is invalid (present but wrong).
  validate?: (value: string) => string | null;
};

export type ReportSpec = {
  type: ReportType;
  title: string;
  clause: string;
  requiredFields: FieldRule[];
};

const RISK_VALUES = ["low", "medium", "high"];

export const REPORT_SPECS: Record<Exclude<ReportType, "unknown">, ReportSpec> = {
  observation_log: {
    type: "observation_log",
    title: "HSE Observation Tracking Log",
    clause: "GI 6.004 (Near Miss & Safety Observation Reporting)",
    requiredFields: [
      { key: "observation", label: "Observation", clause: "GI 6.004" },
      { key: "recommendation", label: "Recommendation", clause: "GI 6.004" },
      { key: "corrective_action", label: "Corrective Action", clause: "GI 6.006 (Loss Prevention Compliance Review)" },
      {
        key: "risk",
        label: "Risk Rating",
        clause: "CSM (Risk Assessment)",
        validate: (v) =>
          RISK_VALUES.includes(v.trim().toLowerCase()) ? null : `Risk rating "${v}" is not valid (must be Low, Medium or High).`,
      },
      { key: "location", label: "Location", clause: "GI 6.004" },
      { key: "hse_reference", label: "HSE Reference (GI/CSM/CSSP)", clause: "GI 6.006" },
      { key: "date_open", label: "Date Opened", clause: "GI 6.004" },
      { key: "reported_by", label: "Reported By", clause: "GI 6.004" },
    ],
  },
  "24h_initial_report": {
    type: "24h_initial_report",
    title: "24-Hour Initial Report",
    clause: "GI 6.000 Supplement 4",
    requiredFields: [
      { key: "incident_category", label: "Incident Category Type", clause: "GI 6.000 Supplement 4" },
      { key: "incident_datetime", label: "Incident Date & Time", clause: "GI 6.000 Supplement 4" },
      { key: "incident_description", label: "Incident Description (who/what/when/where/mechanism)", clause: "GI 6.000 Supplement 4" },
      { key: "injured_personnel", label: "Details of Injured Personnel", clause: "GI 6.000 Supplement 4" },
      { key: "responsible_org", label: "SA Responsible Organization", clause: "GI 6.000 Supplement 4" },
      { key: "work_permit_required", label: "Did Activity Require SA Work Permit?", clause: "GI 2.100 (Work Permit System)" },
      { key: "signoff_name", label: "Report Completed By — Name", clause: "GI 6.000 Supplement 4" },
      { key: "signoff_loginid", label: "Report Completed By — Login ID", clause: "GI 6.000 Supplement 4" },
      { key: "signoff_date", label: "Report Completed By — Date", clause: "GI 6.000 Supplement 4" },
    ],
  },
  investigation_status: {
    type: "investigation_status",
    title: "Investigation Status Report",
    clause: "GI 6.000 Supplement 7",
    requiredFields: [
      { key: "correspondence_number", label: "Correspondence Number", clause: "GI 6.000 Supplement 7" },
      { key: "incident_name", label: "Name of Incident", clause: "GI 6.000 Supplement 7" },
      { key: "what_happened", label: "What Happened (description)", clause: "GI 6.000 Supplement 7" },
      { key: "causation_theories", label: "Causation Theories", clause: "GI 6.000 Supplement 7" },
      { key: "primary_failures", label: "Initial Primary Failures & Draft Causal Factors", clause: "GI 6.000 Supplement 7" },
      { key: "immediate_precautions", label: "Immediate Precautions to Take", clause: "GI 6.000 Supplement 7" },
      { key: "chairman_signature", label: "Investigation Committee Chairman Signature", clause: "GI 6.000 Supplement 7" },
    ],
  },
};

export function getSpec(type: ReportType): ReportSpec | null {
  if (type === "unknown") return null;
  return REPORT_SPECS[type] ?? null;
}

// The canonical field keys the AI is asked to populate, grouped by report type,
// so the extraction prompt and the checker stay in sync.
export function requiredKeys(type: ReportType): string[] {
  const spec = getSpec(type);
  return spec ? spec.requiredFields.map((f) => f.key) : [];
}
