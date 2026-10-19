#!/usr/bin/env python3
"""Site-wide consistency gate for the ATT&CK knowledge platform.

This catches the classes of failure the JSON validator and HTML link checker
cannot see: stale sitemaps, missing social/README images, pages that are not
wired into the platform, leftover placeholders, and documentation that still
says "14 tactics" while the data uses 15.

Run from the repo root:  python scripts/check_site.py
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://souhaieb-marzouk.github.io/attack-knowledge-platform/"
SKIP_DIRS = {".git", ".venv", "venv", "__pycache__", "node_modules", ".vs"}
failures = []


def fail(msg):
    print(f"  [FAIL] {msg}")
    failures.append(msg)


def ok(msg):
    print(f"  [OK]   {msg}")


def files(pattern):
    for path in sorted(ROOT.rglob(pattern)):
        if not any(part in SKIP_DIRS for part in path.parts):
            yield path


def main():
    print("Checking HTML page integrity ...")
    html_files = list(files("*.html"))
    empty = [p for p in html_files if p.stat().st_size == 0]
    if empty:
        for p in empty:
            fail(f"empty HTML file: {p.relative_to(ROOT).as_posix()}")
    else:
        ok(f"{len(html_files)} HTML files, none empty")

    rows = json.loads((ROOT / "data" / "techniques.json").read_text(encoding="utf-8"))
    implemented = [r for r in rows if r.get("status") == "implemented"]

    print("Checking implemented guide metadata ...")
    for row in implemented:
        rel = row.get("page", "")
        path = ROOT / rel
        if not path.is_file():
            fail(f"{row['id']}: missing page {rel}")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        canonical = BASE + rel
        m = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']', text, re.I)
        if not m or m.group(1) != canonical:
            fail(f"{row['id']}: canonical is not {canonical}")
        for tag in re.findall(r'<meta\s+property=["\']og:[^"\']+["\']\s+content=["\']([^"\']+)["\']', text, re.I):
            if "example.com" in tag:
                fail(f"{row['id']}: OG metadata still points at example.com")
        if "{{" in text or "REPLACE_WITH_SERVER_NONCE" in text:
            fail(f"{row['id']}: page still contains a placeholder")
        if re.search(r"14[- ]tactic|14 Enterprise|14 tactics", text, re.I):
            fail(f"{row['id']}: page still says 14 tactics")
    ok(f"{len(implemented)} implemented guides checked")

    print("Checking README local links and images ...")
    readme = ROOT / "README.md"
    if not readme.exists():
        fail("README.md is missing")
    else:
        text = readme.read_text(encoding="utf-8")
        refs = re.findall(r"!?\[[^\]]*\]\(([^)\s]+)", text)
        for ref in refs:
            if ref.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = ref.split("#", 1)[0]
            if target and not (ROOT / target).exists():
                fail(f"README: broken local reference '{ref}'")
        if "assets/img/screens/" not in text:
            fail("README: does not use the screenshots folder")
        if "assets/img/social.png" in text and not (ROOT / "assets" / "img" / "social.png").exists():
            fail("README: social.png is missing")
        if re.search(r"14[- ]tactic|14 Enterprise|14 tactics", text, re.I):
            fail("README: still says 14 tactics")
        ok("README local references checked")

    print("Checking sitemap ...")
    sitemap = ROOT / "sitemap.xml"
    if not sitemap.exists():
        fail("sitemap.xml is missing")
    else:
        xml = sitemap.read_text(encoding="utf-8")
        locs = re.findall(r"<loc>\s*(.*?)\s*</loc>", xml, re.S)
        seen = set()
        for loc in locs:
            parsed = urlparse(loc)
            if not loc.startswith(BASE):
                fail(f"sitemap: URL outside the site base: {loc}")
                continue
            rel = loc[len(BASE):].split("?", 1)[0].split("#", 1)[0]
            rel = rel or "index.html"
            if rel.endswith("/"):
                rel += "index.html"
            seen.add(rel)
            if not (ROOT / rel).is_file():
                fail(f"sitemap: missing target {rel}")
        must = ["index.html", "techniques/index.html", "actors/index.html",
                "mitigations/index.html", "campaigns/index.html", "tools/index.html",
                "tools/sigma.html", "tools/coverage.html", "tools/false-positives.html",
                "docs/sigma-rule-guide.html"]
        must += [r["page"] for r in implemented]
        actors = json.loads((ROOT / "data" / "actors.json").read_text(encoding="utf-8"))
        must += [a["page"] for a in actors if a.get("status") == "implemented" and a.get("page")]
        for rel in must:
            if rel not in seen:
                fail(f"sitemap: missing required page {rel}")
        ok(f"sitemap: {len(locs)} URLs checked")

    print("Checking Sigma log-case coverage ...")
    rules = sorted((ROOT / "sigma" / "rules").glob("*.yml"))
    missing = [r.name for r in rules if not ((ROOT / "tests" / "sigma_cases" / r.stem / "positive.jsonl").is_file()
                                             and (ROOT / "tests" / "sigma_cases" / r.stem / "negative.jsonl").is_file())]
    if missing:
        for name in missing:
            fail(f"Sigma rule has no positive/negative log case: {name}")
    else:
        ok(f"{len(rules)} Sigma rules have positive and negative log cases")

    print("Checking global assets and copy ...")
    for rel in ("assets/img/social.png", "assets/img/favicon.svg"):
        if not (ROOT / rel).is_file():
            fail(f"missing global asset {rel}")
    for rel in ("README.md", "index.html"):
        text = (ROOT / rel).read_text(encoding="utf-8")
        if re.search(r"14[- ]tactic|14 Enterprise|14 tactics", text, re.I):
            fail(f"{rel}: still says 14 tactics")
    social = ROOT / "assets" / "img" / "social.png"
    if social.exists() and social.stat().st_size < 10000:
        fail("social.png looks too small to be a 1200x630 card")
    ok("global assets and copy checked")

    print()
    if failures:
        print(f"RESULT: {len(failures)} problem(s)")
        return 1
    print("RESULT: site consistency checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
