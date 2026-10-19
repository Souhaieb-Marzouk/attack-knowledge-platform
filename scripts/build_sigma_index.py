#!/usr/bin/env python3
"""Build data/sigma-index.json from sigma/rules/ for the Sigma Library page.
Run locally:  python scripts/build_sigma_index.py
Run in CI:    same command (see .github/workflows/sigma-validate.yml)
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import yaml

RULES_DIR = Path("sigma/rules")
OUT = Path("data/sigma-index.json")


def technique_ids(tags):
    return sorted(t.replace("attack.", "").upper() for t in tags or [] if t.startswith("attack.t"))


def main():
    entries = []
    for path in sorted(RULES_DIR.rglob("*.yml")):
        with path.open(encoding="utf-8") as fh:
            rule = yaml.safe_load(fh)
        tags = rule.get("tags") or []
        stem = path.stem
        case_dir = Path("tests/sigma_cases") / stem
        entries.append({
            "file": path.as_posix(),
            "id": rule.get("id", ""),
            "title": rule.get("title", ""),
            "description": (rule.get("description") or "").strip(),
            "level": rule.get("level", ""),
            "status": rule.get("status", ""),
            "logsource": {
                "category": (rule.get("logsource") or {}).get("category", ""),
                "product": (rule.get("logsource") or {}).get("product", ""),
            },
            "tactics": sorted(t.replace("attack.", "").replace("_", "-") for t in tags if t.startswith("attack.") and not t.startswith("attack.t")),
            "techniques": technique_ids(tags),
            "author": rule.get("author", ""),
            "date": str(rule.get("date", "")),
            "log_tested": (case_dir / "positive.jsonl").is_file() and (case_dir / "negative.jsonl").is_file(),
            "cases": f"tests/sigma_cases/{stem}" if case_dir.is_dir() else "",
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(entries),
        "rules": entries,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} with {len(entries)} rules")


if __name__ == "__main__":
    main()