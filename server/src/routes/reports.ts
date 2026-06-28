import { Router } from "express";
import multer from "multer";
import { writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { db } from "../db/db.ts";
import { extractReport } from "../services/extract.ts";
import { evaluateReport } from "../services/evaluate.ts";
import { checkDuplicate } from "../services/duplicate.ts";
import { detectKind, sha256, UPLOAD_DIR } from "../utils/files.ts";

export const reportsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB (some scanned reports are large)
});
const uploadSingle = upload.single("file");

reportsRouter.post("/", (req, res) => {
  // Run multer manually so its errors return clean JSON, not an HTML page.
  uploadSingle(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message ?? "Upload failed." });
    void handleReport(req, res);
  });
});

// Step 1 of the review flow: analyze WITHOUT saving, so the user can review/edit
// the extracted data (fix OCR mistakes) before it's committed.
reportsRouter.post("/preview", (req, res) => {
  uploadSingle(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message ?? "Upload failed." });
    void handlePreview(req, res);
  });
});

async function handlePreview(req: any, res: any) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name must be 'file')." });
    const { originalname, mimetype, buffer } = req.file;
    const kind = detectKind(mimetype, originalname);
    const hash = sha256(buffer);
    const storedName = `${hash}${extname(originalname) || ""}`;
    writeFileSync(join(UPLOAD_DIR, storedName), buffer);

    const extraction = await extractReport(buffer, mimetype, kind, originalname);
    const dup = checkDuplicate(extraction);
    const compliance = await evaluateReport(extraction);

    res.json({
      storedName,
      originalName: originalname,
      fileKind: kind,
      contentHash: hash,
      filePath: `/uploads/${storedName}`,
      reportType: extraction.reportType,
      rawText: extraction.rawText,
      reporter: extraction.reporter,
      location: extraction.location,
      riskRecord: extraction.riskRecord, // editable by the user before commit
      verdict: compliance.verdict,
      reportTitle: compliance.reportLabel,
      complianceScore: compliance.complianceScore,
      findings: compliance.findings,
      recommendations: compliance.recommendations,
      relevantClauses: compliance.relevantClauses,
      aiSummary: compliance.summary,
      duplicate: dup.isDuplicate ? { ...dup } : null,
    });
  } catch (err: any) {
    console.error("[reports] preview failed:", err);
    res.status(500).json({ error: err?.message ?? "Preview failed." });
  }
}

// Step 2: commit the (possibly user-edited) data. Re-runs duplicate detection on
// the edited content, then stores the report + (if accepted) an observation.
reportsRouter.post("/commit", (req, res) => void handleCommit(req, res));

async function handleCommit(req: any, res: any) {
  try {
    const b = req.body ?? {};
    if (!b.storedName || !b.riskRecord) return res.status(400).json({ error: "Missing storedName or riskRecord." });

    // Re-check duplicates against the EDITED content.
    const fauxExtraction: any = {
      riskRecord: b.riskRecord, reportType: b.reportType ?? "unknown",
      rawText: b.rawText ?? "", fields: {}, reporter: b.reporter ?? null, location: b.location ?? null, date: null,
    };
    const dup = checkDuplicate(fauxExtraction);

    const verdict = dup.isDuplicate ? "DUPLICATE_DETECTED" : (b.verdict === "ACCEPTED" ? "ACCEPTED" : "NOT_ACCEPTED");
    const storeInData = verdict === "ACCEPTED";
    const createdAt = new Date().toISOString();

    const info = db.prepare(
      `INSERT INTO reports (
        created_at, report_type, original_filename, file_path, file_kind, ocr_text,
        extracted_json, verdict, findings_json, recommendations_json, compliance_score,
        duplicate_of_id, content_hash, reporter, location, relevant_clauses_json, ai_summary, stored_in_data
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      createdAt, b.reportType ?? "unknown", b.originalName ?? null, b.storedName ? `/uploads/${b.storedName}` : null,
      b.fileKind ?? null, b.rawText ?? null, JSON.stringify(fauxExtraction), verdict,
      JSON.stringify(b.findings ?? []), JSON.stringify(b.recommendations ?? []), b.complianceScore ?? null,
      dup.duplicateOfId, b.contentHash ?? null, b.riskRecord.reported_by ?? b.reporter ?? null,
      b.riskRecord.location ?? b.location ?? null, JSON.stringify(b.relevantClauses ?? []), b.aiSummary ?? null,
      storeInData ? 1 : 0,
    );
    const reportId = Number(info.lastInsertRowid);

    let addedToData = false;
    if (storeInData) {
      const r = b.riskRecord;
      db.prepare(
        `INSERT INTO observations (
          week, sno, observation, recommendation, corrective_action, status, date_open, type,
          category, risk, source, location, hse_reference, reported_by, source_file, origin, report_id, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        null, reportId, r.observation, r.recommendation, r.corrective_action, "open",
        r.date ?? createdAt.slice(0, 10), "Submitted Report", r.category, r.risk, "AI Submission",
        r.location, r.hse_reference, r.reported_by, `submission #${reportId}`, "submission", reportId, createdAt,
      );
      addedToData = true;
    }

    res.json({
      id: reportId, createdAt, verdict, reportType: b.reportType,
      reportTitle: b.reportTitle, complianceScore: b.complianceScore,
      project: b.riskRecord.location ?? b.location, addedToData, storedInLogOnly: !addedToData,
      duplicate: dup.isDuplicate ? { ...dup } : null,
      findings: b.findings ?? [],
      recommendations: dup.isDuplicate ? [dup.message] : (b.recommendations ?? []),
      relevantClauses: b.relevantClauses ?? [], aiSummary: b.aiSummary,
      riskRecord: b.riskRecord, extracted: {}, reporter: b.reporter, location: b.location,
      filePath: b.storedName ? `/uploads/${b.storedName}` : null, fileKind: b.fileKind,
    });
  } catch (err: any) {
    console.error("[reports] commit failed:", err);
    res.status(500).json({ error: err?.message ?? "Commit failed." });
  }
}

async function handleReport(req: any, res: any) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name must be 'file')." });

    const { originalname, mimetype, buffer } = req.file;
    const kind = detectKind(mimetype, originalname);
    const hash = sha256(buffer);

    // Persist the file (hash-named to de-duplicate storage).
    const storedName = `${hash}${extname(originalname) || ""}`;
    const storedPath = join(UPLOAD_DIR, storedName);
    writeFileSync(storedPath, buffer);

    // 1) AI read/extract (incl. a normalized risk record).
    const extraction = await extractReport(buffer, mimetype, kind, originalname);

    // 2) Content-based duplicate check (observation+location+category+risk).
    const dup = checkDuplicate(extraction);

    // 3) Rules-first evaluation against the GI rulebook (RAG + AI).
    const compliance = await evaluateReport(extraction);
    const relevantClauses = compliance.relevantClauses;
    const groundedSummary = compliance.summary;

    const verdict = dup.isDuplicate ? "DUPLICATE_DETECTED" : compliance.verdict;
    const createdAt = new Date().toISOString();

    // Only an ACCEPTED, non-duplicate report becomes real data (an observation).
    const storeInData = verdict === "ACCEPTED";

    // Always log the submission (accepted / not accepted / duplicate).
    const info = db
      .prepare(
        `INSERT INTO reports (
          created_at, report_type, original_filename, file_path, file_kind, ocr_text,
          extracted_json, verdict, findings_json, recommendations_json, compliance_score,
          duplicate_of_id, content_hash, reporter, location, relevant_clauses_json, ai_summary,
          stored_in_data
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        createdAt,
        extraction.reportType,
        originalname,
        `/uploads/${storedName}`,
        kind,
        extraction.rawText,
        JSON.stringify(extraction),
        verdict,
        JSON.stringify(compliance.findings),
        JSON.stringify(compliance.recommendations),
        compliance.complianceScore,
        dup.duplicateOfId,
        hash,
        extraction.reporter,
        extraction.location,
        JSON.stringify(relevantClauses),
        groundedSummary,
        storeInData ? 1 : 0,
      );
    const reportId = Number(info.lastInsertRowid);

    // Accepted + non-duplicate → add its risk record to the observation data,
    // attached to its project (location). Rejected/duplicate are log-only.
    let addedToData = false;
    if (storeInData) {
      const r = extraction.riskRecord;
      db.prepare(
        `INSERT INTO observations (
          week, sno, observation, recommendation, corrective_action, status,
          date_open, type, category, risk, source, location, hse_reference,
          reported_by, source_file, origin, report_id, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        null, reportId,
        r.observation, r.recommendation, r.corrective_action, "open",
        r.date ?? createdAt.slice(0, 10), "Submitted Report", r.category, r.risk,
        "AI Submission", r.location, r.hse_reference, r.reported_by,
        `submission #${reportId}`, "submission", reportId, createdAt,
      );
      addedToData = true;
    }

    res.json({
      id: reportId,
      createdAt,
      verdict,
      reportType: extraction.reportType,
      reportTitle: compliance.reportLabel,
      evaluationMode: compliance.mode,
      complianceScore: compliance.complianceScore,
      project: extraction.riskRecord.location ?? extraction.location,
      addedToData,
      storedInLogOnly: !addedToData,
      duplicate: dup.isDuplicate ? { ...dup } : null,
      findings: compliance.findings,
      recommendations: dup.isDuplicate
        ? [dup.message ?? "Duplicate submission — logged, not stored."]
        : compliance.recommendations,
      relevantClauses,
      aiSummary: groundedSummary,
      riskRecord: extraction.riskRecord,
      extracted: extraction.fields,
      reporter: extraction.reporter,
      location: extraction.location,
      filePath: `/uploads/${storedName}`,
      fileKind: kind,
    });
  } catch (err: any) {
    console.error("[reports] analysis failed:", err);
    res.status(500).json({ error: err?.message ?? "Analysis failed." });
  }
}

reportsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, created_at, report_type, original_filename, verdict, compliance_score,
              reporter, location, ai_summary, stored_in_data, duplicate_of_id
       FROM reports ORDER BY id DESC LIMIT 500`,
    )
    .all();
  res.json(rows);
});

reportsRouter.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Report not found." });
  row.extracted = JSON.parse(row.extracted_json ?? "{}");
  row.findings = JSON.parse(row.findings_json ?? "[]");
  row.recommendations = JSON.parse(row.recommendations_json ?? "[]");
  res.json(row);
});
