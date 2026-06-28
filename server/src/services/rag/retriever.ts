import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = join(__dirname, "..", "..", "..", "data", "corpus.json");

export type Chunk = { id: number; source: string; clause: string; text: string };
export type Passage = { source: string; clause: string; excerpt: string; score: number };

const STOP = new Set(
  ("a an the of to in for on and or is are be by with as at from this that these those shall must " +
    "will would should may can not no any all each per which when where who whom into out over under " +
    "it its their there here than then so such if else do does done has have had was were been being").split(" "),
);

// Recurring GI page header/footer boilerplate that carries no clause content.
const BOILER = /general instruction manual|saudi aramco 7180|complete revision|issuing org|approval page number/i;

function looksBoilerplate(text: string): boolean {
  const head = text.slice(0, 160);
  if (BOILER.test(head)) return true;
  const digits = (head.match(/\d/g)?.length ?? 0) / Math.max(head.length, 1);
  return digits > 0.25;
}

// Strip a leading run of GI header boilerplate so the excerpt starts at real content.
function cleanExcerpt(text: string): string {
  let t = text.replace(/Saudi Aramco 7180[^.]*?(COMPLETE REVISION|NEW INSTRUCTION)/i, "");
  t = t.replace(/\b\d{2}-\d{3}-\d{3}-\d{2}\b/g, ""); // doc serials
  t = t.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "");   // page markers
  t = t.replace(/PAGE\s+(NO\.?|NUMBER)\s+\d+\s+OF\s+\d+/gi, "");
  return t.replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

// BM25 lexical retriever over the pre-built corpus.json. No API key required.
export class Retriever {
  private chunks: Chunk[] = [];
  private tf: Map<string, number>[] = [];
  private df = new Map<string, number>();
  private len: number[] = [];
  private avgdl = 0;
  private ready = false;
  private k1 = 1.5;
  private b = 0.75;

  get available(): boolean {
    this.ensure();
    return this.ready && this.chunks.length > 0;
  }

  get size(): number {
    this.ensure();
    return this.chunks.length;
  }

  private ensure() {
    if (this.ready) return;
    this.ready = true;
    if (!existsSync(CORPUS_PATH)) {
      console.warn("[rag] corpus.json not found — run `npm run build:corpus`. RAG disabled.");
      return;
    }
    const data = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
    this.chunks = data.chunks ?? [];
    let totalLen = 0;
    for (const c of this.chunks) {
      const toks = tokenize(c.text);
      const m = new Map<string, number>();
      for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
      this.tf.push(m);
      this.len.push(toks.length);
      totalLen += toks.length;
      for (const t of m.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgdl = this.chunks.length ? totalLen / this.chunks.length : 0;
    console.log(`[rag] loaded ${this.chunks.length} chunks`);
  }

  retrieve(query: string, k = 3, perSourceCap = 1): Passage[] {
    this.ensure();
    if (!this.chunks.length) return [];
    const qterms = [...new Set(tokenize(query))];
    const N = this.chunks.length;

    const scored: { i: number; score: number }[] = [];
    for (let i = 0; i < N; i++) {
      const dl = this.len[i] || 1;
      let s = 0;
      for (const t of qterms) {
        const f = this.tf[i].get(t);
        if (!f) continue;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        s += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * (dl / this.avgdl))));
      }
      if (s > 0) {
        if (looksBoilerplate(this.chunks[i].text)) s *= 0.2; // demote page headers/footers
        scored.push({ i, score: s });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const out: Passage[] = [];
    const perSource = new Map<string, number>();
    for (const { i, score } of scored) {
      const c = this.chunks[i];
      const used = perSource.get(c.source) ?? 0;
      if (used >= perSourceCap) continue;
      perSource.set(c.source, used + 1);
      const clean = cleanExcerpt(c.text);
      out.push({
        source: c.source,
        clause: c.clause,
        excerpt: clean.length > 320 ? clean.slice(0, 320).trim() + "…" : clean,
        score: Math.round(score * 100) / 100,
      });
      if (out.length >= k) break;
    }
    return out;
  }
}
