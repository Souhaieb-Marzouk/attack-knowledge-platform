# Resume & interview kit

These are the bullets to adapt, not a generic list. Keep the two strongest on
the resume and use the rest as interview stories. Replace a number only when
the measured value changes.

## Detection Engineer flavor (primary)

- Built and operate a public MITRE ATT&CK knowledge platform (GitHub Pages,
  vanilla HTML/CSS/JS, zero runtime dependencies) with **20 hand-written
  technique deep-dives**, a **597-technique / 15-tactic catalogue**, and a
  JSON data layer that drives the explorer, hubs, search and prev/next.
- Authored and validated **141 Sigma rules** with a detection-as-code CI gate:
  `sigma check`, Splunk conversion, **141 positive and 141 negative JSONL log
  fixtures**, four deliberately broken negative rules, and an auto-generated
  rule index committed back to `main`.
- Modeled realistic Windows Security/Sysmon, auditd/auth, CloudTrail, Entra ID,
  M365, Okta, Zeek, pfSense, Apache and BIND events; documented per-rule
  threshold metadata for the SIEM layer.
- Built cross-linked navigation (breadcrumbs, used-by/mitigated-by/detected-by
  chips, prev/next) and a live/full-catalogue ATT&CK Explorer, so a reader can
  walk the attack chain by clicks.

## SOC / Threat Intel flavor

- Created beginner-friendly (CEFR B1) technique guides covering attacker
  tradecraft, detection opportunities and response, including a real-world
  case study for each of 20 techniques.
- Linked **180 threat actors, 44 mitigations and 59 campaigns** into the
  technique graph; actor and mitigation cards expose the techniques they use
  or counter.
- Wrote a false-positive gallery and tuning notes for high-noise rules,
  focusing on alert-fatigue reduction rather than detection volume.
- Maintained a public, source-attributed ATT&CK catalogue in a 15-tactic
  (Stealth / Defense Impairment) model, with strict JSON schemas and
  case-exact page paths validated on Linux CI.

## Engineering / automation flavor

- Shipped a zero-backend client-side search (Ctrl+K) over the full catalogue:
  inverted index, ranked results, keyboard-first modal, and live guides
  boosted above planned rows.
- Built a strict site-quality pipeline: case-sensitive path checks,
  non-empty/integrated page checks, link checking, sitemap/README/asset
  consistency, and a generated Sigma index — all on free GitHub Actions for a
  public repository.
- Migrated a 582-empty-page scaffold into 20 real guides with a single
  integration contract, a live/full-catalogue UI toggle, and a documented
  contribution workflow.

## Numbers to quote

| Metric | Value |
|---|---|
| Live guides | 20 |
| ATT&CK techniques tracked | 597 |
| Tactics | 15 |
| Live tactics | 5 |
| Sigma rules | 141 |
| Positive log cases | 141 |
| Negative log cases | 141 |
| Deliberately broken negative rules | 4 |
| Techniques covered by the library | 42 / 597 (7.0%) |
| Live guides with a library rule | 20 / 20 |
| Actors / mitigations / campaigns | 180 / 44 / 59 |

## 30-second pitch

"I built a public MITRE ATT&CK knowledge platform that explains, in plain
English, how an attacker uses a technique and exactly how a defender sees it
in logs. It has 20 full guides, a 597-technique catalogue, 141 Sigma rules with
positive and negative log tests, and a detection-as-code gate that runs on
every push. MITRE tells you what a technique is; this site shows what it looks
like on an analyst's screen."

## STAR stories

### 1 — Making a 582-page scaffold honest

**Situation:** The repository had a complete platform shell but 582 empty
placeholder HTML pages. The validator was green because it only warned about
missing pages.

**Task:** Make the live site and the repository tell the truth, without
throwing away the full ATT&CK catalogue.

**Action:** Removed the empty pages, made `page` an implemented-only field,
added case-exact path validation, non-empty/integrated page checks, and a
site-consistency gate; then promoted two previously hidden parent guides.

**Result:** 20 real guides, zero empty HTML, and a validator that fails on the
bugs that used to pass silently.

### 2 — Turning page-only rules into a tested library

**Situation:** The guides contained roughly 130 Sigma blocks, but the library
had five rules. Nothing connected the two, and no rule had a log test.

**Task:** Build a validated library with evidence, not just YAML.

**Action:** Extracted and normalised 128 embedded rules, reconciled three
duplicates, converted deprecated count pipes into base-event rules plus
threshold metadata, generated realistic positive/negative JSONL fixtures, and
wrote a dependency-free Sigma evaluator for the CI gate.

**Result:** 141 rules, 282 log cases, 0 schema failures, 0 conversion failures,
and a rule library that now feeds coverage and cross-links.

### 3 — Keeping the platform usable at 597 techniques

**Situation:** The matrix and techniques hub were designed for 17 rows. At 597
they became a wall of planned tiles.

**Task:** Keep the full catalogue while making the 20 live guides the first
thing a visitor sees.

**Action:** Replaced the 597-tile matrix with a three-stage tactic → technique →
sub-technique explorer, added a live/full-catalogue toggle to the explorer and the hub,
defaulted to live, preserved the choice in `localStorage`, and ranked live
guides above planned rows in search.

**Result:** A first visit shows the finished work; the roadmap is still one
click away.

## Questions to practice

1. **Why plain HTML?** Static files are the cheapest, fastest and most durable
   hosting model for reference content; the constraint also makes the search,
   data layer and CI the interesting engineering.
2. **How do you know a rule works?** Three layers: schema (`sigma check`),
   conversion to Splunk, and positive/negative JSONL events. The four broken
   rules prove the gate rejects bad input.
3. **Why not test against a real SIEM?** The public CI has no SIEM. The log
   fixtures model real event schemas and can be replaced with lab exports;
   the threshold metadata is explicit about what belongs in the SIEM layer.
4. **How do you keep 597 rows current?** The next step is a reproducible STIX
   sync with a drift issue; the schema and validator already enforce the
   contract.
5. **What would you do next?** Actor dossiers and campaign timelines, then a
   STIX sync and learning paths. The roadmap is public.

## Attribution

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. This project
is unofficial and educational; see [`NOTICE`](NOTICE).
