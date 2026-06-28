import "dotenv/config";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { inferClause } from "../inferClause.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const KNOWLEDGE_DIR =
  process.env.KNOWLEDGE_DIR ??
  "C:\\Users\\potato\\Desktop\\Camera\\OneDrive_2026-05-21\\Waseet Technology (AI) Solutions";

const OUT = join(__dirname, "..", "..", "..", "data", "corpus.json");

const CHUNK_CHARS = 900;
const OVERLAP_CHARS = 150;
const MAX_CHUNKS_PER_DOC = 600; // safety bound for very large manuals

type Chunk = { id: number; source: string; clause: string; text: string };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    let end = Math.min(i + CHUNK_CHARS, clean.length);
    // try to break on a sentence/space boundary near the end
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("; "));
      if (lastStop > CHUNK_CHARS * 0.5) end = i + lastStop + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = end - OVERLAP_CHARS;
  }
  return chunks;
}

async function extractText(file: string): Promise<string> {
  const ext = extname(file).toLowerCase();
  if (ext === ".pdf") {
    const parser = new PDFParse({ data: readFileSync(file) });
    try {
      const r = await parser.getText();
      return r.text ?? "";
    } finally {
      await parser.destroy?.();
    }
  }
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer: readFileSync(file) });
    return value ?? "";
  }
  return "";
}

async function build() {
  mkdirSync(dirname(OUT), { recursive: true });

  const files = walk(KNOWLEDGE_DIR).filter((f) => /\.(pdf|docx)$/i.test(f));
  console.log(`Found ${files.length} documents under:\n  ${KNOWLEDGE_DIR}\n`);

  const chunks: Chunk[] = [];
  let id = 0;
  let docs = 0;
  let skipped = 0;

  for (const file of files) {
    const base = file.split(/[\\/]/).pop()!;
    try {
      const text = await extractText(file);
      const parts = chunkText(text);
      if (parts.length === 0) { skipped++; continue; }
      const clause = inferClause(base);
      for (const p of parts) chunks.push({ id: id++, source: base, clause, text: p });
      docs++;
      console.log(`  ${String(parts.length).padStart(4)} chunks  [${clause}]  ${base}`);
    } catch (e: any) {
      skipped++;
      console.warn(`  SKIP  ${base} — ${e?.message ?? e}`);
    }
  }

  const payload = { builtAt: new Date().toISOString(), docs, chunkCount: chunks.length, chunks };
  writeFileSync(OUT, JSON.stringify(payload));
  const mb = (JSON.stringify(payload).length / 1024 / 1024).toFixed(1);
  console.log(`\nIndexed ${chunks.length} chunks from ${docs} docs (${skipped} skipped). Wrote ${OUT} (${mb} MB).`);
}

build();
