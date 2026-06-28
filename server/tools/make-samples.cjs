// Generates sample HSE report images for demoing the camera/vision flow.
// Produces a COMPLETE report (-> Accepted) and an INCOMPLETE one (-> Not Accepted).
const { createCanvas } = require("@napi-rs/canvas");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const OUT_DIR = join(__dirname, "..", "..", "samples");
mkdirSync(OUT_DIR, { recursive: true });

function render(rows, filename) {
  const W = 850, H = 1150;
  const c = createCanvas(W, H);
  const x = c.getContext("2d");

  // page
  x.fillStyle = "#ffffff";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "#cbd5e1";
  x.strokeRect(20, 20, W - 40, H - 40);

  // header band
  x.fillStyle = "#0f766e";
  x.fillRect(20, 20, W - 40, 70);
  x.fillStyle = "#ffffff";
  x.font = "bold 26px Arial";
  x.fillText("SAUDI ARAMCO — 24-HOUR INITIAL REPORT", 40, 65);
  x.font = "14px Arial";
  x.fillStyle = "#0f172a";
  x.fillText("GI 6.000 Supplement 4   |   Loss Prevention Department", 40, 115);

  let y = 160;
  for (const [label, value] of rows) {
    x.fillStyle = "#475569";
    x.font = "bold 15px Arial";
    x.fillText(label, 40, y);
    x.fillStyle = "#0f172a";
    x.font = "16px Arial";
    // wrap value
    const words = String(value).split(" ");
    let line = "", ly = y + 24;
    for (const w of words) {
      if ((line + w).length > 80) { x.fillText(line, 60, ly); line = ""; ly += 22; }
      line += w + " ";
    }
    x.fillText(line, 60, ly);
    // underline rule
    x.strokeStyle = "#e2e8f0";
    x.beginPath(); x.moveTo(40, ly + 10); x.lineTo(W - 40, ly + 10); x.stroke();
    y = ly + 42;
  }

  const buf = c.toBuffer("image/png");
  const path = join(OUT_DIR, filename);
  writeFileSync(path, buf);
  console.log("wrote", path);
}

// COMPLETE — every required field present  -> should be ACCEPTED
render(
  [
    ["Incident Category Type:", "Injury/Illness"],
    ["Incident Date & Time:", "05/12/26  14:30"],
    ["Incident Description (who/what/when/where/mechanism):",
      "Contractor Ahmed K. slipped on spilled hydraulic oil near pump P-101 at ABQ Main Plant at 14:30 while transferring tools; sustained a minor wrist sprain (fall, same level)."],
    ["Details of Injured Personnel:", "Ahmed K., Badge 88213, Iqama 2419xxxxxx, age 34, Pakistani, ABC Contracting"],
    ["SA Responsible Organization:", "Project Construction Dept (PCD-21)"],
    ["Did Activity Require SA Work Permit?:", "Yes"],
    ["Report Completed By — Name:", "M. Hussain"],
    ["Report Completed By — Login ID:", "HUSSAINM"],
    ["Report Completed By — Date:", "05/12/2026"],
  ],
  "sample_24h_report_COMPLETE.png",
);

// INCOMPLETE — missing sign-off Login ID + Date, blank injured personnel -> NOT ACCEPTED
render(
  [
    ["Incident Category Type:", "Fire"],
    ["Incident Date & Time:", "05/24/26  09:10"],
    ["Incident Description (who/what/when/where/mechanism):",
      "Small fire at welding station 3 in Manifa when sparks ignited nearby rags; extinguished with a portable extinguisher within two minutes. No injuries."],
    ["Details of Injured Personnel:", ""],
    ["SA Responsible Organization:", "Manifa Maintenance Unit"],
    ["Did Activity Require SA Work Permit?:", "Yes"],
    ["Report Completed By — Name:", "S. Raid"],
    ["Report Completed By — Login ID:", ""],
    ["Report Completed By — Date:", ""],
  ],
  "sample_24h_report_INCOMPLETE.png",
);
