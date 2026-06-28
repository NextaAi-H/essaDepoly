import OpenAI from "openai";
import { db } from "../db/db.ts";

// ── Tool executors (parametrized SQL; group/sort columns are whitelisted) ────────

const GROUPABLE = new Set(["risk", "status", "category", "location", "type", "reported_by", "week"]);
const SORTABLE_PROJECT = new Set(["total", "high", "medium", "low", "open"]);

function buildWhere(a: any): { clause: string; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];
  for (const k of ["risk", "status", "category", "location"]) {
    if (a?.[k]) { where.push(`lower(${k}) = lower(?)`); params.push(a[k]); }
  }
  if (a?.search) {
    where.push("(observation LIKE ? OR recommendation LIKE ? OR hse_reference LIKE ?)");
    params.push(`%${a.search}%`, `%${a.search}%`, `%${a.search}%`);
  }
  return { clause: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

function getOverview() {
  const t = db.prepare(`
    SELECT COUNT(*) total,
      SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) closed,
      SUM(CASE WHEN risk='high' THEN 1 ELSE 0 END) high,
      SUM(CASE WHEN risk='medium' THEN 1 ELSE 0 END) medium,
      SUM(CASE WHEN risk='low' THEN 1 ELSE 0 END) low,
      SUM(CASE WHEN status='open' AND risk='high' THEN 1 ELSE 0 END) high_open
    FROM observations`).get() as any;
  const subs = db.prepare(`
    SELECT COUNT(*) submissions,
      SUM(CASE WHEN verdict='ACCEPTED' THEN 1 ELSE 0 END) accepted,
      SUM(CASE WHEN verdict='NOT_ACCEPTED' THEN 1 ELSE 0 END) rejected,
      SUM(CASE WHEN verdict='DUPLICATE_DETECTED' THEN 1 ELSE 0 END) duplicates
    FROM reports`).get() as any;
  const projects = (db.prepare("SELECT COUNT(DISTINCT location) c FROM observations WHERE location IS NOT NULL").get() as any).c;
  return { ...t, projects, submissions: subs };
}

function aggregate(a: any) {
  const col = GROUPABLE.has(a?.group_by) ? a.group_by : "risk";
  const { clause, params } = buildWhere(a);
  const rows = db.prepare(
    `SELECT ${col} AS key, COUNT(*) AS count FROM observations ${clause}
     GROUP BY ${col} ORDER BY count DESC LIMIT 25`,
  ).all(...params);
  return { group_by: col, results: rows };
}

function searchObs(a: any) {
  const { clause, params } = buildWhere(a);
  const limit = Math.min(Number(a?.limit) || 15, 25);
  const rows = db.prepare(
    `SELECT id, week, substr(observation,1,200) observation, category, risk, status,
            location, hse_reference, reported_by, date_open, origin
     FROM observations ${clause} ORDER BY risk='high' DESC, id DESC LIMIT ?`,
  ).all(...params, limit) as any[];
  const total = (db.prepare(`SELECT COUNT(*) c FROM observations ${clause}`).get(...params) as any).c;
  return { matched: total, showing: rows.length, rows };
}

function listProjects(a: any) {
  const sort = SORTABLE_PROJECT.has(a?.sort_by) ? a.sort_by : "total";
  const limit = Math.min(Number(a?.limit) || 15, 30);
  const rows = db.prepare(
    `SELECT location project, COUNT(*) total,
       SUM(CASE WHEN risk='high' THEN 1 ELSE 0 END) high,
       SUM(CASE WHEN risk='medium' THEN 1 ELSE 0 END) medium,
       SUM(CASE WHEN risk='low' THEN 1 ELSE 0 END) low,
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open
     FROM observations WHERE location IS NOT NULL AND TRIM(location)<>''
     GROUP BY location ORDER BY ${sort} DESC LIMIT ?`,
  ).all(limit);
  return { sorted_by: sort, projects: rows };
}

const EXECUTORS: Record<string, (a: any) => any> = {
  get_dashboard_overview: getOverview,
  aggregate_observations: aggregate,
  search_observations: searchObs,
  list_projects: listProjects,
};

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_dashboard_overview",
      description: "Overall totals: observation counts by risk and status, high-risk-open count, project count, and submission stats (accepted/rejected/duplicate).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "aggregate_observations",
      description: "Count observations grouped by a field, with optional filters. Use for 'how many', 'breakdown by', 'which category/site has most'.",
      parameters: {
        type: "object",
        properties: {
          group_by: { type: "string", enum: ["risk", "status", "category", "location", "type", "reported_by", "week"] },
          risk: { type: "string" }, status: { type: "string" }, category: { type: "string" },
          location: { type: "string" }, search: { type: "string", description: "keyword filter on observation text" },
        },
        required: ["group_by"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_observations",
      description: "Return actual observation rows matching filters/keyword. Use when the user wants to see specific findings/examples.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string" }, risk: { type: "string" }, status: { type: "string" },
          category: { type: "string" }, location: { type: "string" }, limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List projects (sites) with their risk counts (total/high/medium/low/open), sortable. Use for 'which projects have most risks'.",
      parameters: {
        type: "object",
        properties: { sort_by: { type: "string", enum: ["total", "high", "medium", "low", "open"] }, limit: { type: "number" } },
      },
    },
  },
];

const SYSTEM = `You are the HSE data assistant for Al-Essa (a Saudi Aramco contractor).
You answer questions about the HSE observation dataset, projects (sites), and submitted reports.
ALWAYS call the tools to look up real data before answering — never invent numbers.
A "project" is a site/location. "Risks" are observations. Be concise, lead with the numbers,
and when listing items use short bullet points. If a question is outside this data, say so briefly.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runChat(history: ChatMessage[]): Promise<{ reply: string; toolsUsed: string[] }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  if (provider !== "openai" || !key) {
    return {
      reply: "The data assistant needs the OpenAI key to be active (set AI_PROVIDER=openai and OPENAI_API_KEY in server/.env). Right now it's not enabled.",
      toolsUsed: [],
    };
  }

  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const messages: any[] = [
    { role: "system", content: SYSTEM },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
  ];
  const toolsUsed: string[] = [];

  for (let i = 0; i < 5; i++) {
    const res = await client.chat.completions.create({
      model, temperature: 0, messages, tools: TOOLS, tool_choice: "auto",
    });
    const msg = res.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { reply: msg.content ?? "(no response)", toolsUsed };
    }

    for (const call of msg.tool_calls) {
      const fn = EXECUTORS[call.function.name];
      let result: any;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = fn ? fn(args) : { error: "unknown tool" };
      } catch (e: any) {
        result = { error: e?.message ?? "tool failed" };
      }
      toolsUsed.push(call.function.name);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: "I gathered the data but couldn't finalize an answer — please rephrase.", toolsUsed };
}
