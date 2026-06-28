// Infer a human-facing Aramco reference code from a source filename.
// Used to label corpus chunks so RAG evidence shows e.g. "GI 2.709" or "CSM".
export function inferClause(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, ""); // drop extension

  // GI 6.000 supplements (the incident-reporting supplement family).
  const sup = name.match(/supplement\s*0*(\d+)/i);
  if (sup && /\b6[\s._]?000\b|\bGI\s*6\b/i.test(name)) return `GI 6.000 Supplement ${sup[1]}`;

  // SAES engineering standards, e.g. "SAES-A-111".
  const saes = name.match(/SAES[-\s]?([A-Z])[-\s]?(\d+)/i);
  if (saes) return `SAES-${saes[1].toUpperCase()}-${saes[2]}`;

  if (/construction safety manual|\bCSM\b/i.test(name)) return "CSM";
  if (/\bMMSR\b/i.test(name)) return "MMSR";
  if (/safelife/i.test(name)) return "SafeLife";
  if (/handbook/i.test(name)) return "Aramco Safety Handbook";
  if (/\bSMG\s*0*(\d+)[-_]0*(\d+)/i.test(name)) {
    const m = name.match(/\bSMG\s*0*(\d+)[-_]0*(\d+)/i)!;
    return `SMG ${m[1]}-${m[2]}`;
  }

  // "G.I. 02.709", "GI 2.100", "G.I NO 298.010"
  const gi = name.match(/\bG\.?\s*I\.?\s*(?:NO\.?\s*)?0*(\d+)\.0*(\d+)/i);
  if (gi) return `GI ${Number(gi[1])}.${gi[2].padStart(3, "0")}`;

  // Underscore numeric style on standalone files, e.g. "0006_004", "1786_001".
  const us = name.match(/\b0*(\d{1,4})_0*(\d{1,3})\b/);
  if (us) return `GI ${Number(us[1] === "0006" ? "6" : us[1])}.${us[2].padStart(3, "0")}`;

  return name.slice(0, 60);
}
