#!/usr/bin/env python3
"""Data-layer integrity validator for the ATT&CK knowledge platform.

Run from the repo root:   python scripts/validate_data.py
Exit codes: 0 = all checks passed, 1 = at least one failure.

Checks
  1. all five hand-maintained JSON files parse, plus the sigma index seed
  2. tactics.json holds the 14 Enterprise tactics, orders 1..14, no dupes
  3. no duplicate ids inside any data file
  4. every technique tactic exists in tactics.json
  5. status values are 'implemented' or 'planned'
  6. implemented rows have a page; planned rows do not
  7. page files exist on disk (warning only - pages land in Phase 4)
  8. used_by / mitigates / uses / techniques cross-references resolve
  9. sigma references point at real files on disk
 10. sigma-index.json parses and its count matches its rules array
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
ROOT = DATA.parent

failures = []
warnings = []


def ok(msg):
    print(f"  [OK]   {msg}")


def fail(msg):
    print(f"  [FAIL] {msg}")
    failures.append(msg)


def warn(msg):
    print(f"  [WARN] {msg}")
    warnings.append(msg)


def load(name):
    with (DATA / name).open(encoding="utf-8") as fh:
        return json.load(fh)


def dup_check(rows, label):
    seen = set()
    dups = []
    for row in rows:
        rid = row.get("id")
        if rid in seen:
            dups.append(rid)
        seen.add(rid)
    if dups:
        fail(f"{label}: duplicate id(s) {dups}")
    else:
        ok(f"{label}: {len(rows)} rows, no duplicate ids")


def main():
    print("Loading JSON files ...")
    try:
        tactics = load("tactics.json")
        techniques = load("techniques.json")
        actors = load("actors.json")
        mitigations = load("mitigations.json")
        campaigns = load("campaigns.json")
        sigma_index = load("sigma-index.json")
        ok("all five data files plus the sigma index seed parse as JSON")
    except (OSError, ValueError) as exc:
        print(f"  [FAIL] could not load data files: {exc}")
        return 1

    print("Checking sigma index seed ...")
    if not isinstance(sigma_index.get("rules"), list) or sigma_index.get("count") != len(sigma_index.get("rules", [])):
        fail("sigma-index.json: must hold a 'rules' array and a 'count' equal to its length")
    else:
        ok(f"sigma-index.json: count={sigma_index['count']} matches rules array")

    tactic_ids = {t.get("id") for t in tactics}
    tech_ids = {t.get("id") for t in techniques}
    actor_ids = {a.get("id") for a in actors}
    mit_ids = {m.get("id") for m in mitigations}
    _campaign_ids = {c.get("id") for c in campaigns}

    print("Checking tactics ...")
    orders = sorted(t.get("order", 0) for t in tactics)
    if len(tactics) == 14 and orders == list(range(1, 15)):
        ok("14 Enterprise tactics, orders 1..14")
    else:
        fail(f"tactics.json must hold exactly 14 tactics with orders 1..14 (found {len(tactics)}, orders {orders})")
    dup_check(tactics, "tactics.json")

    print("Checking technique rows ...")
    dup_check(techniques, "techniques.json")
    for row in techniques:
        rid = row.get("id", "?")
        if row.get("tactic") not in tactic_ids:
            fail(f"{rid}: unknown tactic '{row.get('tactic')}'")
        if row.get("status") not in ("implemented", "planned"):
            fail(f"{rid}: status must be 'implemented' or 'planned' (found '{row.get('status')}')")
        if row.get("status") == "implemented" and not row.get("page"):
            fail(f"{rid}: implemented rows must carry a 'page' value")
        if row.get("status") == "planned" and row.get("page"):
            fail(f"{rid}: planned rows must not carry a 'page' value")
        if row.get("page") and not (ROOT / row["page"]).exists():
            warn(f"{rid}: page file '{row['page']}' not on disk yet (fine until Phase 4)")
        for ref in row.get("used_by", []):
            if ref not in actor_ids:
                fail(f"{rid}: used_by references unknown actor '{ref}'")
        for ref in row.get("mitigated_by", []):
            if ref not in mit_ids:
                fail(f"{rid}: mitigated_by references unknown mitigation '{ref}'")
        for ref in row.get("sigma", []):
            if not (ROOT / ref).exists():
                fail(f"{rid}: sigma references missing file '{ref}'")
    ok("technique rows: tactic/status/page/relation checks complete")

    print("Checking actor rows ...")
    dup_check(actors, "actors.json")
    for row in actors:
        for ref in row.get("uses", []):
            if ref not in tech_ids:
                fail(f"{row.get('id', '?')}: uses references unknown technique '{ref}'")

    print("Checking mitigation rows ...")
    dup_check(mitigations, "mitigations.json")
    for row in mitigations:
        for ref in row.get("mitigates", []):
            if ref not in tech_ids:
                fail(f"{row.get('id', '?')}: mitigates references unknown technique '{ref}'")

    print("Checking campaign rows ...")
    dup_check(campaigns, "campaigns.json")
    for row in campaigns:
        for ref in row.get("techniques", []):
            if ref not in tech_ids:
                fail(f"{row.get('id', '?')}: techniques references unknown technique '{ref}'")

    implemented = sum(1 for r in techniques if r.get("status") == "implemented")
    print()
    print(f"Summary: {len(techniques)} techniques ({implemented} implemented), "
          f"{len(actors)} actors, {len(mitigations)} mitigations, {len(campaigns)} campaigns")
    if failures:
        print(f"RESULT: {len(failures)} failure(s), {len(warnings)} warning(s)")
        return 1
    print(f"RESULT: all checks passed ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())