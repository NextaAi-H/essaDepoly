export type Passage = { source: string; clause: string; excerpt: string; score: number };

export type Finding = {
  field: string;
  issue: string;
  clause: string;
  clauseTitle?: string;
  evidence?: Passage[];
};

export type AnalyzeResult = {
  id: number;
  createdAt: string;
  verdict: "ACCEPTED" | "NOT_ACCEPTED" | "DUPLICATE_DETECTED";
  reportType: string;
  reportTitle: string;
  complianceScore: number;
  project: string | null;
  addedToData: boolean;
  storedInLogOnly: boolean;
  duplicate: { message: string; duplicateOfId: number } | null;
  findings: Finding[];
  recommendations: string[];
  relevantClauses: Passage[];
  aiSummary: string | null;
  riskRecord: Record<string, string | null>;
  extracted: Record<string, string | null>;
  reporter: string | null;
  location: string | null;
  filePath: string;
  fileKind: string;
};

export type Observation = Record<string, any> & {
  id: number;
  observation: string;
  risk: string;
  status: string;
  category: string;
  location: string;
  hse_reference: string;
  reported_by: string;
  date_open: string;
  origin: string;
};

export type Project = {
  project: string;
  total: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  closed: number;
  submitted: number;
};

export type Facets = {
  risk: string[];
  status: string[];
  category: string[];
  type: string[];
  location: string[];
};

export type DashboardStats = {
  kpis: {
    totalObservations: number;
    open: number;
    closed: number;
    closeRate: number;
    highRiskOpen: number;
    submissions: number;
    acceptanceRate: number | null;
  };
  byRisk: { name: string; value: number }[];
  byWeek: { week: number; open: number; closed: number; total: number }[];
  byCategory: { name: string; value: number }[];
  byLocation: { name: string; value: number }[];
  topClauses: { name: string; value: number }[];
  byReporter: { name: string; total: number; closed: number; complianceScore: number }[];
};

export type HighRisk = {
  id: number;
  week: number;
  observation: string;
  recommendation: string;
  category: string;
  location: string;
  hse_reference: string;
  date_open: string;
  reported_by: string;
};

export type Submission = {
  id: number;
  created_at: string;
  report_type: string;
  original_filename: string;
  verdict: string;
  compliance_score: number;
  reporter: string | null;
  location: string | null;
};

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  stats: () => getJSON<DashboardStats>("/api/dashboard/stats"),
  highRisk: () => getJSON<HighRisk[]>("/api/dashboard/high-risk"),
  submissions: () => getJSON<Submission[]>("/api/reports"),
  report: (id: number) => getJSON<any>(`/api/reports/${id}`),
  projects: () => getJSON<Project[]>("/api/projects"),
  project: (name: string) =>
    getJSON<{ project: string; observations: Observation[]; reports: Submission[] }>(
      `/api/projects/${encodeURIComponent(name)}`,
    ),
  facets: () => getJSON<Facets>("/api/observations/facets"),
  chat: async (messages: { role: "user" | "assistant"; content: string }[]) => {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? `${r.status} ${r.statusText}`);
    }
    return r.json() as Promise<{ reply: string; toolsUsed: string[] }>;
  },
  observations: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, String(v)]),
    ).toString();
    return getJSON<{ total: number; rows: Observation[] }>(`/api/observations?${qs}`);
  },
  updateObservation: async (id: number, patch: Record<string, any>) => {
    const r = await fetch(`/api/observations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `${r.status}`);
    return r.json() as Promise<Observation>;
  },
  analyze: async (file: File): Promise<AnalyzeResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/reports", { method: "POST", body: fd });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? `${r.status} ${r.statusText}`);
    }
    return r.json();
  },
  // Step 1: analyze without saving, returns editable extracted data.
  preview: async (file: File): Promise<PreviewResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/reports/preview", { method: "POST", body: fd });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `${r.status} ${r.statusText}`);
    return r.json();
  },
  // Step 2: commit the (possibly edited) extracted data.
  commit: async (payload: PreviewResult): Promise<AnalyzeResult> => {
    const r = await fetch("/api/reports/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `${r.status} ${r.statusText}`);
    return r.json();
  },
};

export type PreviewResult = {
  storedName: string;
  originalName: string;
  fileKind: string;
  contentHash: string;
  filePath: string;
  reportType: string;
  rawText: string;
  reporter: string | null;
  location: string | null;
  riskRecord: Record<string, any>;
  verdict: "ACCEPTED" | "NOT_ACCEPTED";
  reportTitle: string;
  complianceScore: number;
  findings: Finding[];
  recommendations: string[];
  relevantClauses: Passage[];
  aiSummary: string | null;
  duplicate: { message: string; duplicateOfId: number } | null;
};
