#!/usr/bin/env python3
"""Data-layer integrity validator for the ATT&CK knowledge platform.

Run from the repo root:   python scripts/validate_data.py
Exit codes: 0 = all checks passed, 1 = at least one failure.

The validator is deliberately strict: a reference that only works on a
case-insensitive Windows filesystem is a failure, and a page that exists but
is empty (or not wired into the shared platform) is a failure too. CI runs this
on Linux, where the live GitHub Pages site is served from.
"""
import json
import os
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
ROOT = DATA.parent
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED_PAGE_BYTES = 1024

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


def case_exact(rel):
    """Return (True, '') only if every path segment matches on-disk casing."""
    current = ROOT
    for part in Path(rel).parts:
        try:
            names = os.listdir(current)
        except OSError as exc:
            return False, f"cannot list {current}: {exc}"
        if part not in names:
            matches = [name for name in names if name.lower() == part.lower()]
            if matches:
                return False, f"case mismatch '{part}' (on disk: '{matches[0]}')"
            return False, f"missing path segment '{part}'"
        current = current / part
    return True, ""


def check_page(row):
    rid = row.get("id", "?")
    rel = row.get("page", "")
    if not rel:
        fail(f"{rid}: implemented rows must carry a 'page' value")
        return
    if not rel.startswith("techniques/") or not rel.endswith(".html"):
        fail(f"{rid}: page must be a techniques/*.html path (found '{rel}')")
        return
    exact, detail = case_exact(rel)
    if not exact:
        fail(f"{rid}: page path is not case-exact: {rel} ({detail})")
        return
    path = ROOT / rel
    if not path.is_file():
        fail(f"{rid}: page file does not exist: {rel}")
        return
    size = path.stat().st_size
    if size < REQUIRED_PAGE_BYTES:
        fail(f"{rid}: page file is only {size} bytes (empty/stub pages are not allowed): {rel}")
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    if "platform.js" not in text:
        fail(f"{rid}: page does not load assets/js/platform.js: {rel}")
    if "atk-header" not in text:
        fail(f"{rid}: page has no #atk-header mount: {rel}")
    if not re.search(r'data-technique\s*=\s*["\']' + re.escape(str(rid)) + r'["\']', text):
        fail(f"{rid}: page does not declare data-technique=\"{rid}\": {rel}")
    if not re.search(r"<title>[^<]+</title>", text, re.I):
        fail(f"{rid}: page has no non-empty <title>: {rel}")
    if not re.search(r'<meta\s+name=["\']description["\']', text, re.I):
        fail(f"{rid}: page has no meta description: {rel}")
    if not re.search(r'<link\s+rel=["\']canonical["\']', text, re.I):
        fail(f"{rid}: page has no canonical link: {rel}")
    if "REPLACE_WITH_SERVER_NONCE" in text:
        fail(f"{rid}: page contains the REPLACE_WITH_SERVER_NONCE placeholder: {rel}")
    print(f"  [OK]   {rid}: page exists, is non-empty and integrated ({size} bytes)")


def main():
    print("Loading JSON files ...")
    try:
        tactics = load("tactics.json")
        techniques = load("techniques.json")
        actors = load("actors.json")
        mitigations = load("mitigations.json")
        campaigns = load("campaigns.json")
        sigma_index = load("sigma-index.json")
    except (OSError, ValueError) as exc:
        print(f"  [FAIL] could not load data files: {exc}")
        return 1
    ok("all data files parse as JSON")

    print("Checking sigma index ...")
    if not isinstance(sigma_index.get("rules"), list) or sigma_index.get("count") != len(sigma_index.get("rules", [])):
        fail("sigma-index.json: must hold a 'rules' array and a 'count' equal to its length")
    else:
        ok(f"sigma-index.json: count={sigma_index['count']} matches rules array")

    tactic_ids = {t.get("id") for t in tactics}
    tech_ids = {t.get("id") for t in techniques}
    actor_ids = {a.get("id") for a in actors}
    mit_ids = {m.get("id") for m in mitigations}
    campaign_ids = {c.get("id") for c in campaigns}

    print("Checking tactics ...")
    orders = sorted(t.get("order", 0) for t in tactics)
    if len(tactics) == 15 and orders == list(range(1, 16)):
        ok("15 Enterprise tactics, orders 1..15")
    else:
        fail(f"tactics.json must hold exactly 15 tactics with orders 1..15 (found {len(tactics)}, orders {orders})")
    dup_check(tactics, "tactics.json")

    print("Checking technique rows ...")
    dup_check(techniques, "techniques.json")
    implemented = 0
    for row in techniques:
        rid = row.get("id", "?")
        if row.get("tactic") not in tactic_ids:
            fail(f"{rid}: unknown tactic '{row.get('tactic')}'")
        if row.get("status") not in ("implemented", "planned"):
            fail(f"{rid}: status must be 'implemented' or 'planned' (found '{row.get('status')}')")
        if row.get("status") == "implemented":
            implemented += 1
            check_page(row)
        elif "page" in row:
            fail(f"{rid}: planned rows must not carry a 'page' value (remove the file and the field)")
        if not isinstance(row.get("summary"), str) or not row.get("summary").strip():
            fail(f"{rid}: summary must be a non-empty string")
        if len(row.get("summary", "")) > 500:
            warn(f"{rid}: summary is longer than 500 characters")
        updated = row.get("updated", "")
        if not DATE_RE.match(str(updated)):
            warn(f"{rid}: updated is not YYYY-MM-DD ('{updated}')")
        for ref in row.get("used_by", []):
            if ref not in actor_ids:
                fail(f"{rid}: used_by references unknown actor '{ref}'")
        for ref in row.get("mitigated_by", []):
            if ref not in mit_ids:
                fail(f"{rid}: mitigated_by references unknown mitigation '{ref}'")
        for ref in row.get("sigma", []):
            if not (ROOT / ref).is_file():
                fail(f"{rid}: sigma references missing file '{ref}'")
            exact, _ = case_exact(ref)
            if not exact:
                fail(f"{rid}: sigma path is not case-exact '{ref}'")

    # A reciprocal graph is the point of the platform. These are warnings while
    # the graph is being populated; P3 makes them reciprocal.
    for row in techniques:
        if row.get("status") != "implemented":
            continue
        for aid in row.get("used_by", []):
            actor = next((a for a in actors if a.get("id") == aid), None)
            if actor is not None and row["id"] not in actor.get("uses", []):
                warn(f"{row['id']}: used_by {aid} but {aid}.uses does not list it")
        for mid in row.get("mitigated_by", []):
            mit = next((m for m in mitigations if m.get("id") == mid), None)
            if mit is not None and row["id"] not in mit.get("mitigates", []):
                warn(f"{row['id']}: mitigated_by {mid} but {mid}.mitigates does not list it")

    print("Checking actor rows ...")
    dup_check(actors, "actors.json")
    for row in actors:
        for ref in row.get("uses", []):
            if ref not in tech_ids:
                fail(f"{row.get('id', '?')}: uses references unknown technique '{ref}'")
        if row.get("status") == "implemented":
            rel = row.get("page", "")
            if not rel:
                fail(f"{row.get('id', '?')}: implemented actors need a page")
                continue
            exact, detail = case_exact(rel)
            if not exact:
                fail(f"{row.get('id', '?')}: actor page is not case-exact ({detail}): {rel}")
                continue
            path = ROOT / rel
            if not path.is_file() or path.stat().st_size < 1024:
                fail(f"{row.get('id', '?')}: actor page is missing or empty: {rel}")
            else:
                body = path.read_text(encoding="utf-8", errors="replace")
                if "platform.js" not in body or 'rel="canonical"' not in body:
                    fail(f"{row.get('id', '?')}: actor page is not integrated or has no canonical: {rel}")
                else:
                    ok(f"{row.get('id', '?')}: actor dossier exists and is integrated ({rel})")

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

    print("Checking false-positive gallery ...")
    fp_path = DATA / "fp-gallery.json"
    if not fp_path.exists():
        print("  [SKIP] data/fp-gallery.json not present (optional)")
    else:
        try:
            fp_gallery = json.loads(fp_path.read_text(encoding="utf-8"))
        except ValueError as exc:
            fail(f"fp-gallery.json: invalid JSON ({exc})")
            fp_gallery = []
        seen_rules = set()
        for group in fp_gallery:
            rule_file = group.get("rule", "")
            if rule_file in seen_rules:
                fail(f"fp-gallery.json: duplicate group for rule '{rule_file}'")
            seen_rules.add(rule_file)
            if not rule_file.startswith("sigma/rules/") or not rule_file.endswith(".yml"):
                fail(f"fp-gallery.json: '{rule_file}' must be a sigma/rules/*.yml path")
            if not (ROOT / rule_file).is_file():
                fail(f"fp-gallery.json: rule file missing on disk: '{rule_file}'")
            entries = group.get("entries")
            if not isinstance(entries, list) or not entries:
                fail(f"fp-gallery.json: '{rule_file}' needs a non-empty 'entries' array")
                continue
            for entry in entries:
                for field in ("name", "scenario", "evidence", "tuning"):
                    if not entry.get(field):
                        fail(f"fp-gallery.json: '{rule_file}' entry '{entry.get('name', '?')}' missing '{field}'")
        if fp_gallery:
            ok(f"fp-gallery.json: {len(fp_gallery)} rule group(s)")

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
