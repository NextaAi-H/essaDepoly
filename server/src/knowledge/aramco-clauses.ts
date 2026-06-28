// Curated map of HSE topics → the Aramco clause findings should be cited against.
// Derived from the GI library shared by the client and the "HSE Reference" column
// in the observation logs. Used to attach an exact clause to each finding.

export type Clause = {
  code: string;
  title: string;
  keywords: string[];
};

export const CLAUSES: Clause[] = [
  { code: "GI 2.100", title: "Work Permit System", keywords: ["work permit", "permit to work", "ptw", "permit"] },
  { code: "GI 2.709", title: "Gas Testing Procedure", keywords: ["gas test", "gas testing", "gas monitor", "h2s", "lel", "atmospheric test"] },
  { code: "GI 6.001", title: "Confined Space Entry / Notification of Incidents", keywords: ["confined space", "entry permit"] },
  { code: "GI 6.004", title: "Near Miss and Safety Observation Reporting", keywords: ["near miss", "safety observation"] },
  { code: "GI 6.005", title: "Reporting, Recording & Investigation of Injuries", keywords: ["injury", "first aid", "recordable", "investigation"] },
  { code: "GI 6.011", title: "Quarterly Safety Inspection", keywords: ["inspection", "quarterly"] },
  { code: "GI 6.012", title: "Isolation, Lockout, Use of Hold Tags", keywords: ["lockout", "loto", "isolation", "hold tag", "tag out"] },
  { code: "GI 6.028", title: "Heat Stress Program", keywords: ["heat stress", "heat", "shade", "hydration", "drinking water", "rest shelter"] },
  { code: "GI 6.030", title: "Traffic and Vehicle Safety", keywords: ["traffic", "vehicle", "driving", "seat belt", "mva", "speed"] },
  { code: "GI 7.024", title: "Marine and Offshore Crane, Hoist and Rigging Operations", keywords: ["rigging", "hoist", "offshore crane"] },
  { code: "GI 7.025", title: "Heavy Equipment Operator Testing and Certification", keywords: ["operator certification", "saoo", "heavy equipment operator", "operator card"] },
  { code: "GI 7.028", title: "Crane Lifts Types and Procedures", keywords: ["crane", "lift plan", "lifting", "boom truck"] },
  { code: "GI 7.029", title: "Rigging Hardware Requirements", keywords: ["sling", "shackle", "rigging hardware", "wire rope"] },
  { code: "GI 8.001", title: "Safety Requirements for Scaffolding", keywords: ["scaffold", "scaffolding", "ladder"] },
  { code: "GI 8.002", title: "Safety Spectacles", keywords: ["spectacles", "eye protection", "safety glasses"] },
  { code: "GI 8.005", title: "Protective Footwear", keywords: ["footwear", "safety shoes", "boots"] },
  { code: "GI 150.002", title: "First Aid, CPR Training and First Aid Kits", keywords: ["first aid kit", "cpr", "first aider"] },
  { code: "GI 1781.001", title: "Inspection, Testing & Maintenance of Fire Protection Equipment", keywords: ["fire extinguisher", "fire protection", "fire equipment"] },
  { code: "GI 1787.000", title: "Report of Fire, Emergency and False Alarm", keywords: ["fire report", "false alarm"] },
  { code: "GI 430.001", title: "Waste Management", keywords: ["waste", "housekeeping", "debris", "disposal"] },
  { code: "CSM", title: "Construction Safety Manual", keywords: ["barricade", "barricading", "excavation", "trench", "fall protection", "ppe", "signage", "electrical"] },
  { code: "CSSP", title: "Contractor Site Safety Plan", keywords: ["welfare", "amenities", "site facilities"] },
];

const GENERIC: Clause = { code: "CSM", title: "Construction Safety Manual", keywords: [] };

// Best-effort clause lookup from free text (an observation, recommendation or HSE
// reference string). Returns the most specific match, falling back to the CSM.
export function findClause(...texts: (string | null | undefined)[]): Clause {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  if (!hay) return GENERIC;

  // If the text already names a clause code, prefer that.
  const direct = hay.match(/\bgi\s*(\d+\.?\d*)/i);
  if (direct) {
    const code = `GI ${direct[1]}`;
    const known = CLAUSES.find((c) => c.code.toLowerCase() === code.toLowerCase());
    if (known) return known;
    return { code, title: "Saudi Aramco General Instruction", keywords: [] };
  }

  let best: { clause: Clause; hits: number } | null = null;
  for (const c of CLAUSES) {
    const hits = c.keywords.reduce((n, kw) => (hay.includes(kw) ? n + 1 : n), 0);
    if (hits > 0 && (!best || hits > best.hits)) best = { clause: c, hits };
  }
  return best?.clause ?? GENERIC;
}
