// 4 mock reports for testing the rules-first engine, tuned to 4 outcomes:
//  1. Template type, complete            -> expect ACCEPTED
//  2. Template type, missing sign-off    -> expect NOT ACCEPTED
//  3. Non-template type, complete        -> expect ACCEPTED
//  4. Non-template type, missing gas test-> expect NOT ACCEPTED
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

// 1) TEMPLATE + should be ACCEPTED — 24-Hour Initial Report, thoroughly complete
render("SAUDI ARAMCO — 24-HOUR INITIAL REPORT", "Template type · designed to PASS", [
  ["Incident Category Type:", "Injury/Illness"],
  ["Incident Date & Time:", "06/15/2026  10:20"],
  ["Incident Location:", "WQGCP-1, Building 3, Workshop Bay 2, Grid C-4"],
  ["Incident Description (who/what/when/where/how):", "At 10:20 on 06/15/2026, contractor Imran S. sustained a minor hand laceration while handling sheet metal in Workshop Bay 2 at WQGCP-1; cause was an unguarded sheet edge. First aid administered on site, no lost time."],
  ["Details of Injured Personnel:", "Imran S., Badge 77410, Iqama 2390xxxxxx, age 29, Indian national, ABC Contracting, Fabrication crew"],
  ["SA Responsible Organization:", "Project Construction Dept (PCD-14), org code 2114"],
  ["Did Activity Require SA Work Permit?:", "Yes — General Work Permit GWP-2291"],
  ["Immediate Actions / Safeguards:", "Edge guarded, toolbox talk delivered, cut-resistant gloves issued"],
  ["Report Completed By — Name:", "M. Hussain"],
  ["Report Completed By — Login ID:", "HUSSAINM"],
  ["Report Completed By — Date:", "06/15/2026"],
], "test1_template_ACCEPT.png");

// 2) TEMPLATE + should be NOT ACCEPTED — 24-Hour Initial Report missing sign-off + injured details
render("SAUDI ARAMCO — 24-HOUR INITIAL REPORT", "Template type · designed to FAIL", [
  ["Incident Category Type:", "Fire"],
  ["Incident Date & Time:", "06/16/2026  09:10"],
  ["Incident Description:", "Small fire at welding station 3, Manifa; extinguished within 2 minutes."],
  ["Details of Injured Personnel:", ""],                 // blank (must-fix)
  ["SA Responsible Organization:", "Manifa Maintenance Unit"],
  ["Did Activity Require SA Work Permit?:", "Yes"],
  ["Report Completed By — Name:", "S. Raid"],
  ["Report Completed By — Login ID:", ""],                // blank (must-fix)
  ["Report Completed By — Date:", ""],                    // blank (must-fix)
], "test2_template_REJECT.png");

// 3) NON-TEMPLATE + should be ACCEPTED — Hot Work Permit, fully complete
render("HOT WORK PERMIT", "No template on file · judged by GI rules · designed to PASS", [
  ["Permit No / Work Description:", "HWP-5521 — welding repair on pipe support rack"],
  ["Location:", "KHRS CPF, Area 3, Grid B-7"],
  ["Date / Valid Time:", "06/16/2026  07:00–15:00"],
  ["Gas Test Before Work (O2/LEL/H2S):", "O2 20.9%, LEL 0%, H2S 0 ppm — tested 06:45 by certified tester"],
  ["Gas Tester Name:", "A. Rahman (Cert. GT-1183)"],
  ["Fire Watch Assigned:", "Yes — Nadeem K., stationed throughout + 30 min after completion"],
  ["Fire Extinguishers On Site:", "Yes — 2x 9kg DCP within 3 m"],
  ["Precautions / Combustibles Removed:", "Area cleared 11 m radius, fire blanket on cable tray, drains covered"],
  ["Issued By (signature):", "A. Alawami, Permit Issuer — signed"],
  ["Receiver / Performer (signature):", "J. Khan, Foreman — signed"],
], "test3_notemplate_ACCEPT.png");

// 4) NON-TEMPLATE + should be NOT ACCEPTED — Confined Space Entry Permit, gas test blank
render("CONFINED SPACE ENTRY PERMIT", "No template on file · judged by GI rules · designed to FAIL", [
  ["Location / Equipment:", "Vessel V-210, ABQ Main Plant"],
  ["Date:", "06/14/2026"],
  ["Entrant(s):", "Karim A., Bilal H."],
  ["Entry Supervisor:", "S. Raid"],
  ["Standby / Hole Watch:", "Tariq M."],
  ["Gas Test — O2 / LEL / H2S:", ""],                     // blank (must-fix per GI 2.709)
  ["Gas Tester Name & Time:", ""],                        // blank (must-fix)
  ["Authorized Signature:", "S. Raid"],
], "test4_notemplate_REJECT.png");
