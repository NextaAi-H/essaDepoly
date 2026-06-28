// Builds a curated SHOWCASE set covering every report type and verdict, for client demos.
// Filenames encode the expected outcome so you always know what to expect.
const { createCanvas } = require("@napi-rs/canvas");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const OUT = join(__dirname, "..", "..", "showcase");
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

// 01 — Template type, complete -> ACCEPTED
render("SAUDI ARAMCO — 24-HOUR INITIAL REPORT", "Template type · expect ACCEPTED", [
  ["Incident Category Type:", "Injury/Illness"],
  ["Incident Date & Time:", "06/15/2026  10:20"],
  ["Incident Location:", "WQGCP-1, Building 3, Workshop Bay 2, Grid C-4"],
  ["Incident Description (who/what/when/where/how):", "At 10:20 on 06/15/2026, contractor Imran S. sustained a minor hand laceration handling sheet metal in Workshop Bay 2 at WQGCP-1; cause was an unguarded edge. First aid given on site, no lost time."],
  ["Details of Injured Personnel:", "Imran S., Badge 77410, Iqama 2390xxxxxx, age 29, Indian, ABC Contracting"],
  ["SA Responsible Organization:", "Project Construction Dept (PCD-14), org code 2114"],
  ["Did Activity Require SA Work Permit?:", "Yes — GWP-2291"],
  ["Immediate Actions / Safeguards:", "Edge guarded, toolbox talk delivered, cut-resistant gloves issued"],
  ["Report Completed By — Name:", "M. Hussain"],
  ["Report Completed By — Login ID:", "HUSSAINM"],
  ["Report Completed By — Date:", "06/15/2026"],
], "01-ACCEPT-24hour-report.png");

// 02 — Template type, missing sign-off + injured details -> NOT ACCEPTED
render("SAUDI ARAMCO — 24-HOUR INITIAL REPORT", "Template type · expect NOT ACCEPTED", [
  ["Incident Category Type:", "Fire"],
  ["Incident Date & Time:", "06/16/2026  09:10"],
  ["Incident Description:", "Small fire at welding station 3, Manifa; extinguished within 2 minutes."],
  ["Details of Injured Personnel:", ""],
  ["SA Responsible Organization:", "Manifa Maintenance Unit"],
  ["Did Activity Require SA Work Permit?:", "Yes"],
  ["Report Completed By — Name:", "S. Raid"],
  ["Report Completed By — Login ID:", ""],
  ["Report Completed By — Date:", ""],
], "02-REJECT-24hour-report.png");

// 03 — Non-template type (no form on file), complete -> ACCEPTED
const hotWork = [
  ["Permit No / Work Description:", "HWP-5521 — welding repair on pipe support rack"],
  ["Location:", "KHRS CPF, Area 3, Grid B-7"],
  ["Date / Valid Time:", "06/16/2026  07:00–15:00"],
  ["Gas Test Before Work (O2/LEL/H2S):", "O2 20.9%, LEL 0%, H2S 0 ppm — tested 06:45 by certified tester"],
  ["Gas Tester Name:", "A. Rahman (Cert. GT-1183)"],
  ["Fire Watch Assigned:", "Yes — Nadeem K., throughout + 30 min after completion"],
  ["Fire Extinguishers On Site:", "Yes — 2x 9kg DCP within 3 m"],
  ["Precautions / Combustibles Removed:", "Area cleared 11 m radius, fire blanket on cable tray, drains covered"],
  ["Issued By (signature):", "A. Alawami, Permit Issuer — signed"],
  ["Receiver / Performer (signature):", "J. Khan, Foreman — signed"],
];
render("HOT WORK PERMIT", "No template on file · expect ACCEPTED", hotWork, "03-ACCEPT-hot-work-permit.png");

// 04 — Non-template type, gas test blank -> NOT ACCEPTED
render("CONFINED SPACE ENTRY PERMIT", "No template on file · expect NOT ACCEPTED", [
  ["Location / Equipment:", "Vessel V-210, ABQ Main Plant"],
  ["Date:", "06/14/2026"],
  ["Entrant(s):", "Karim A., Bilal H."],
  ["Entry Supervisor:", "S. Raid"],
  ["Standby / Hole Watch:", "Tariq M."],
  ["Gas Test — O2 / LEL / H2S:", ""],
  ["Gas Tester Name & Time:", ""],
  ["Authorized Signature:", "S. Raid"],
], "04-REJECT-confined-space-permit.png");

// 05 — DUPLICATE of 03: same hazard/location, only date + issuer changed -> DUPLICATE
//      (submit 03 first so it is in the data, then submit this one)
const dupHotWork = hotWork.map(([l, v]) =>
  l.startsWith("Date") ? [l, "06/20/2026  07:00–15:00"] :
  l.startsWith("Issued") ? [l, "K. Hamid, Permit Issuer — signed"] : [l, v]);
render("HOT WORK PERMIT", "Same content as #03, only date/issuer changed · expect DUPLICATE", dupHotWork, "05-DUPLICATE-of-03.png");

// 06 — Observation log type, complete -> ACCEPTED
render("HSE OBSERVATION REPORT", "Observation type · expect ACCEPTED", [
  ["Observation:", "Worker observed grinding without a face shield at the fabrication yard, exposing the face to flying particles."],
  ["Recommendation:", "Provide and enforce full face shield use for all grinding activities."],
  ["Corrective Action:", "Work stopped, worker counseled, face shield issued, toolbox talk delivered to the crew."],
  ["Risk Rating:", "High"],
  ["Category:", "PPE"],
  ["Location:", "Rastanura Camp - Fabrication Yard"],
  ["HSE Reference:", "CSM — PPE Requirements"],
  ["Date Opened:", "06/12/2026"],
  ["Reported By:", "Hassan Farooq"],
], "06-ACCEPT-observation.png");
