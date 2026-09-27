#!/usr/bin/env python3
"""Local internal-link checker.

Run from the repo root:   python scripts/check_links.py

Walks every *.html file, collects href/src attributes, resolves them
relative to the file, and flags references to local files that do not
exist. Absolute paths (/assets/...) are flagged on sight: GitHub Pages
project sites serve under a subpath, so absolute paths 404.

Skips: http(s), mailto:, tel:, data: URLs and pure #anchors.
Note: links injected at runtime from JSON are not present in the static
HTML and are therefore not checked by this script.

Exit codes: 0 = all references resolve, 1 = at least one problem.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", ".venv", "venv", "__pycache__", "node_modules"}
ATTR = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
SKIP_PREFIXES = ("http://", "https://", "mailto:", "tel:", "data:", "#")


def html_files():
    for path in sorted(ROOT.rglob("*.html")):
        if not any(part in SKIP_DIRS for part in path.parts):
            yield path


def main():
    errors = []
    files = list(html_files())
    print(f"Scanning {len(files)} HTML file(s) ...")
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        for ref in ATTR.findall(text):
            if not ref or ref.startswith(SKIP_PREFIXES):
                continue
            target = ref.split("#", 1)[0]
            if not target:
                continue
            if target.startswith("/"):
                errors.append(
                    f"{path.relative_to(ROOT).as_posix()}: absolute path '{ref}' - "
                    "use relative paths + SITE_BASE (GitHub Pages serves under a subpath)"
                )
                continue
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                errors.append(f"{path.relative_to(ROOT).as_posix()}: broken reference '{ref}'")
                continue
            # Case-sensitivity check: Pages serves from Linux, where the
            # filesystem is case-sensitive - but Windows and macOS dev
            # machines happily resolve the wrong casing. Compare the
            # referenced spelling against the actual directory entries so
            # this class of 404 is caught locally, not on the live site.
            actual_names = {p.name for p in resolved.parent.iterdir()}
            if resolved.name not in actual_names:
                errors.append(
                    f"{path.relative_to(ROOT).as_posix()}: case mismatch '{ref}' "
                    f"(repo has '{resolved.name}' with different casing)"
                )

    if errors:
        print(f"\n{len(errors)} problem(s):")
        for e in errors:
            print(f"  [FAIL] {e}")
        return 1
    print("  [OK]   all internal references resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())