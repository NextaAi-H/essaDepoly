import mammoth from "mammoth";
import type { AiInput, ExtractionResult } from "./ai/provider.ts";
import { getAiProvider } from "./ai/index.ts";
import type { FileKind } from "../utils/files.ts";

// Turn an uploaded file into AI input, then run the provider to get a structured extraction.
export async function extractReport(
  buffer: Buffer,
  mime: string,
  kind: FileKind,
  filename: string,
): Promise<ExtractionResult> {
  const provider = getAiProvider();
  const input: AiInput = {};

  if (kind === "image") {
    input.imageBase64 = buffer.toString("base64");
    input.mimeType = mime || "image/jpeg";
  } else if (kind === "word") {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      input.text = value;
    } catch {
      input.text = `(Could not read Word file: ${filename})`;
    }
  } else if (kind === "pdf") {
    // Try text extraction first (text-based PDFs like JSAs, CSSPs, GIs).
    // If the PDF has little/no machine-readable text, it's a scan — render its
    // first pages to images and OCR them via vision instead.
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const r = await parser.getText();
      const text = (r.text ?? "").trim();
      // Strip page markers ("-- 3 of 91 --") and whitespace to measure REAL content.
      // A scanned PDF yields only markers, so this collapses to near-zero.
      const meaningful = text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").replace(/\s+/g, "").length;

      if (meaningful > 120) {
        input.text = text.slice(0, 12000);
      } else {
        // Scanned / image-only PDF → render up to 3 pages to PNG for vision OCR.
        const shot = await parser.getScreenshot({ scale: 2, first: 3 });
        const pages = (shot?.pages ?? []) as { data: Uint8Array }[];
        if (pages.length) {
          input.images = pages.map((p) => Buffer.from(p.data).toString("base64"));
        } else {
          input.text = `(This PDF appears to be a scan and no pages could be rendered: ${filename}.)`;
        }
      }
      await parser.destroy?.();
    } catch (e) {
      input.text = `(Could not read PDF: ${filename})`;
    }
  } else {
    input.text = `(Unsupported file type: ${filename})`;
  }

  return provider.extract(input);
}
