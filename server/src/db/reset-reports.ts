import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { db, initSchema } from "./db.ts";
import { UPLOAD_DIR } from "../utils/files.ts";

// Resets the database to its "base" demo state: clears all submitted reports
// (so re-uploading the same files is NOT flagged as a duplicate) while KEEPING
// the historical observation data that powers the dashboard.
initSchema();

const before = (db.prepare("SELECT COUNT(*) c FROM reports").get() as any).c;
db.exec("DELETE FROM reports;");
try { db.exec("DELETE FROM sqlite_sequence WHERE name='reports';"); } catch { /* no-op */ }

// Also remove observations that came from accepted submissions, so the data
// returns to exactly the seeded baseline.
const submittedObs = (db.prepare("SELECT COUNT(*) c FROM observations WHERE origin='submission'").get() as any).c;
db.exec("DELETE FROM observations WHERE origin='submission';");

let removedFiles = 0;
try {
  for (const f of readdirSync(UPLOAD_DIR)) {
    rmSync(join(UPLOAD_DIR, f), { force: true });
    removedFiles++;
  }
} catch { /* uploads dir empty/missing */ }

const obs = (db.prepare("SELECT COUNT(*) c FROM observations").get() as any).c;
console.log(`Reset complete.`);
console.log(`  Cleared submissions       : ${before}`);
console.log(`  Removed submitted records : ${submittedObs}`);
console.log(`  Cleared upload files      : ${removedFiles}`);
console.log(`  Observations now (base)   : ${obs}`);
