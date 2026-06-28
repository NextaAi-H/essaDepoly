# HSE Tool — Demo Playground

Sample reports organized by case. Upload any at **http://localhost:3001 → Submit Report → Upload a file**.
All verified live on GPT-4o. Most files in `accepted/` and `not-accepted/` are **real client reports**.

## `accepted/` — reports that PASS  ✅
| File | Type | Real? |
| --- | --- | --- |
| `01-ACCEPT-24hour-report.png` | 24-Hour Initial Report (complete) | sample |
| `03-ACCEPT-hot-work-permit.png` | Hot Work Permit (no template — GI rules) | sample |
| `06-ACCEPT-observation.png` | Observation report (complete) | sample |
| `07-REAL-CSSP-plan.pdf` | Construction Site Safety Plan | **real** |
| `08-REAL-emergency-response-plan.pdf` | Emergency Response Plan | **real** |
| `09-REAL-photographed-report.jpeg` | Safety statistics (photo) | **real** |
| `REAL-HIP.pdf` | Hazard Identification Plan | **real** |
| `REAL-JSA-excavation(scanned).pdf` | Scanned JSA — read via vision OCR | **real** |
| `REAL-journey-management-plan.pdf` | Journey Management Plan | **real** |
| `REAL-stop-work-form(photo).jpeg` | Stop Work form (photo) | **real** |

## `not-accepted/` — reports that FAIL  ❌
| File | Why it fails |
| --- | --- |
| `02-REJECT-24hour-report.png` | Missing injured-person details + sign-off (critical) |
| `04-REJECT-confined-space-permit.png` | No gas test recorded (critical) |
| `REAL-unreadable-meeting-photo-1.jpeg` | Real photo too blurry/partial to assess |
| `REAL-unreadable-meeting-photo-2.jpeg` | Real photo too blurry/partial to assess |

## `duplicates/` — duplicate detection  🔁
| File | Demo |
| --- | --- |
| `05-DUPLICATE-of-03.png` | Same content as `accepted/03`, only date/issuer changed |

**Duplicate flow:** upload `accepted/03-ACCEPT-hot-work-permit.png` first (it becomes data),
then `duplicates/05-DUPLICATE-of-03.png` → flagged as duplicate, kept out of the data.

## How the judge decides (calibrated, fair-but-strict)
- It first classifies the document: **field report / plan or program / informational / unreadable**.
- It **accepts** legitimate, legible, substantially-complete documents.
- It **fails only on real critical gaps** it can name — a permit with no gas test, an incident report
  with no description/signature, or a document too unreadable to assess.
- It uses the Aramco clauses as **reference for recommendations**, not a checklist that fails a report
  for any clause not explicitly addressed.

## Reset the data to base (run before each demo)
From `hse-pilot/server`:
```
npm run reset:reports
```
Returns the dashboard to the clean 4,103-row baseline (clears submitted reports + uploads).
