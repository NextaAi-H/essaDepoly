// Mock filled HSE reports for testing the RULES-FIRST engine. Deliberately includes
// report types we have NO template for (confined-space & hot-work permits) to prove
// the system judges them purely against the GI rulebook.
const { createCanvas } = require("@napi-rs/canvas");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const OUT = join(__dirname, "..", "..", "samples");
mkdirSync(OUT, { recursive: true });

function render(title, subtitle, rows, file) {
  const W = 850, H = 1180;
  const c = createCanvas(W, H);
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#cbd5e1"; x.strokeRect(20, 20, W - 40, H - 40);
  x.fillStyle = "#0f766e"; x.fillRect(20, 20, W - 40, 64);
  x.fillStyle = "#fff"; x.font = "bold 22px Arial"; x.fillText(title, 40, 60);
  x.fillStyle = "#0f172a"; x.font = "13px Arial"; x.fillText(subtitle, 40, 106);
  let y = 142;
  for (const [label, value] of rows) {
    x.fillStyle = "#475569"; x.font = "bold 14px Arial"; x.fillText(label, 40, y);
    x.fillStyle = value ? "#0f172a" : "#b91c1c"; x.font = "15px Arial";
    const words = String(value || "(blank)").split(" ");
    let line = "", ly = y + 22;
    for (const w of words) {
      if ((line + w).length > 84) { x.fillText(line, 60, ly); line = ""; ly += 21; }
      line += w + " ";
    }
    x.fillText(line, 60, ly);
    x.strokeStyle = "#e2e8f0"; x.beginPath(); x.moveTo(40, ly + 9); x.lineTo(W - 40, ly + 9); x.stroke();
    y = ly + 38;
  }
  writeFileSync(join(OUT, file), c.toBuffer("image/png"));
  console.log("wrote", file);
}

// 1) 24-Hour Initial Report — complete (template-known type) -> expect ACCEPTED
render("SAUDI ARAMCO — 24-HOUR INITIAL REPORT", "Incident reporting", [
  ["Incident Category Type:", "Injury/Illness"],
  ["Incident Date & Time:", "06/15/2026  10:20"],
  ["Incident Description:", "Worker sustained a minor hand laceration while handling sheet metal at WQGCP-1; first aid administered on site."],
  ["Details of Injured Personnel:", "Imran S., Badge 77410, Iqama 2390xxxxxx, age 29, Indian, ABC Contracting"],
  ["SA Responsible Organization:", "Project Construction Dept (PCD-14)"],
  ["Did Activity Require SA Work Permit?:", "Yes"],
  ["Report Completed By — Name:", "M. Hussain"],
  ["Report Completed By — Login ID:", "HUSSAINM"],
  ["Report Completed By — Date:", "06/15/2026"],
], "mock_24h_report.png");

// 2) Confined Space Entry Permit — NO template; gas test NOT recorded -> expect NOT_ACCEPTED via GI 2.709
render("CONFINED SPACE ENTRY PERMIT", "No template on file — must be judged against GI rules", [
  ["Location / Equipment:", "Vessel V-210, ABQ Main Plant"],
  ["Date:", "06/14/2026"],
  ["Entrant(s):", "Karim A., Bilal H."],
  ["Entry Supervisor:", "S. Raid"],
  ["Standby / Hole Watch:", "Tariq M."],
  ["Gas Test — O2 / LEL / H2S:", ""],               // blank — should fail per GI 2.709
  ["Gas Tester Name & Time:", ""],
  ["Authorized Signature:", "S. Raid"],
], "mock_confined_space_permit.png");

// 3) Hot Work Permit — NO template; reasonably complete -> see verdict
render("HOT WORK PERMIT", "No template on file — must be judged against GI rules", [
  ["Work Description:", "Welding repair on pipe support rack, KHRS CPF"],
  ["Location:", "KHRS CPF, Area 3"],
  ["Date / Valid Time:", "06/16/2026  07:00–15:00"],
  ["Gas Test Done Before Work:", "Yes — O2 20.9%, LEL 0%, H2S 0 ppm at 06:45"],
  ["Fire Watch Assigned:", "Yes — Nadeem K."],
  ["Fire Extinguisher On Site:", "Yes (2x DCP)"],
  ["Precautions / Combustibles Removed:", "Area cleared, fire blanket in place"],
  ["Issued By / Receiver Signatures:", "Issued: A. Alawami  /  Received: foreman J. Khan"],
], "mock_hot_work_permit.png");

// 4) Near-Miss Report — NO template; complete -> see verdict
render("NEAR MISS REPORT", "No template on file — must be judged against GI rules", [
  ["What Happened:", "Scaffold plank shifted underfoot at DR-2 KP 304; worker regained balance, no injury."],
  ["Date / Time:", "06/13/2026  13:05"],
  ["Location:", "DR-2 KP 304"],
  ["Reported By:", "Hassan Farooq"],
  ["Immediate Action:", "Area barricaded; scaffold re-inspected and re-tagged by competent person."],
  ["Risk Rating:", "Medium"],
], "mock_near_miss_report.png");
