import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = join(__dirname, "..", "..", "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

export type FileKind = "image" | "pdf" | "word" | "excel" | "other";

export function detectKind(mime: string, filename: string): FileKind {
  const f = filename.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|heic|gif|bmp)$/.test(f)) return "image";
  if (mime === "application/pdf" || f.endsWith(".pdf")) return "pdf";
  if (mime.includes("word") || /\.(docx?|rtf)$/.test(f)) return "word";
  if (mime.includes("sheet") || mime.includes("excel") || /\.(xlsx|xls|csv)$/.test(f)) return "excel";
  return "other";
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export { join as joinPath };
