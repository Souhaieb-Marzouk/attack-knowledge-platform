#!/usr/bin/env python3
"""Detection-as-Code test gate for the Sigma rule library.

Three layers, all required for every rule in sigma/rules/:

1. schema      - `sigma check` accepts the rule
2. conversion  - `sigma convert -t splunk -p splunk_windows` produces output
3. log tests   - the rule matches its positive JSONL and does not match its
                 negative JSONL, using tests/sigma_match.py

The four deliberately broken rules in tests/sigma/negative/ must still be
REJECTED by `sigma check` (proving the gate actually gates). Aggregate rules
use tests/sigma_cases/thresholds.json, because modern Sigma cannot express the
old `selection | count() by ...` pipe syntax.

Exit codes: 0 = all tests passed, 1 = at least one failure.
Local usage: activate .venv first (see sigma/README.md), then
             python tests/test_sigma.py
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sigma_match import evaluate_case  # noqa: E402

RULES_DIR = Path("sigma/rules")
NEGATIVE_DIR = Path("tests/sigma/negative")
CASES_DIR = Path("tests/sigma_cases")
THRESHOLDS = json.loads((CASES_DIR / "thresholds.json").read_text(encoding="utf-8")) \
    if (CASES_DIR / "thresholds.json").exists() else {}

CONVERT_ARGS = ["-t", "splunk", "-p", "splunk_windows"]

SIGMA = shutil.which("sigma")
if SIGMA is None:
    sys.exit("'sigma' not found on PATH - activate the .venv first "
             "(see sigma/README.md) or let CI run the gate.")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def list_rules(directory):
    return sorted(p for p in directory.rglob("*.yml") if p.is_file())


def read_jsonl(path):
    if not path.is_file():
        return None
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main():
    failures = []
    positives = list_rules(RULES_DIR)
    negatives = list_rules(NEGATIVE_DIR)

    if not positives:
        failures.append("No rules found in sigma/rules/ - add at least one rule.")

    print(f"POSITIVE tests: {len(positives)} rule(s) must validate, convert and pass log fixtures")
    # Fast path: one batch call. If either batch fails, fall back to per-rule
    # calls so the output names the exact rule that broke.
    batch_check = run([SIGMA, "check", RULES_DIR.as_posix()])
    batch_convert = run([SIGMA, "convert"] + CONVERT_ARGS + [RULES_DIR.as_posix()])
    batch_ok = (batch_check.returncode == 0 and batch_convert.returncode == 0
                and bool(batch_convert.stdout.strip()))
    if not batch_ok:
        print("  [INFO] batch validation failed; re-checking rules individually for the exact error")

    for rule in positives:
        rel = rule.as_posix()
        label = rule.name

        if not batch_ok:
            chk = run([SIGMA, "check", rel])
            if chk.returncode != 0:
                failures.append(f"CHECK FAILED (should pass): {rel}\n{chk.stdout}{chk.stderr}")
                print(f"  [FAIL] {label} (check)")
                continue
            conv = run([SIGMA, "convert"] + CONVERT_ARGS + [rel])
            if conv.returncode != 0 or not conv.stdout.strip():
                failures.append(f"CONVERT FAILED (should succeed): {rel}\n{conv.stdout}{conv.stderr}")
                print(f"  [FAIL] {label} (convert)")
                continue

        case_dir = CASES_DIR / rule.stem
        pos = read_jsonl(case_dir / "positive.jsonl")
        neg = read_jsonl(case_dir / "negative.jsonl")
        if pos is None or neg is None:
            failures.append(f"MISSING LOG FIXTURES for {rel}: expected {case_dir}/positive.jsonl and negative.jsonl")
            print(f"  [FAIL] {label} (missing log fixtures)")
            continue

        doc = yaml.safe_load(rule.read_text(encoding="utf-8"))
        threshold = THRESHOLDS.get(rel)
        pos_ok, pos_detail = evaluate_case(doc, pos, threshold)
        neg_ok, neg_detail = evaluate_case(doc, neg, threshold)
        if not pos_ok:
            failures.append(f"POSITIVE LOG DID NOT MATCH: {rel}\n{pos_detail}")
            print(f"  [FAIL] {label} (positive log)")
        elif neg_ok:
            failures.append(f"NEGATIVE LOG MATCHED: {rel}\n{neg_detail}")
            print(f"  [FAIL] {label} (negative log matched)")
        else:
            print(f"  [PASS] {label} (schema + convert + positive/negative logs)")

    print(f"NEGATIVE tests: {len(negatives)} broken rule(s) must be REJECTED by the gate")
    for rule in negatives:
        chk = run([SIGMA, "check", rule.as_posix()])
        if chk.returncode != 0:
            print(f"  [PASS] {rule.name} (rejected by sigma check, as expected)")
            continue
        conv = run([SIGMA, "convert"] + CONVERT_ARGS + [rule.as_posix()])
        if conv.returncode != 0 or not conv.stdout.strip():
            print(f"  [PASS] {rule.name} (rejected at convert stage, as expected)")
        else:
            failures.append(f"NOT REJECTED: {rule.as_posix()} - the gate accepted a broken rule!")
            print(f"  [FAIL] {rule.name} (accepted a broken rule)")

    print()
    if failures:
        print(f"RESULT: {len(failures)} failure(s)")
        for failure in failures:
            print("----")
            print(failure)
        return 1
    print(f"RESULT: all tests passed ({len(positives)} positive with log fixtures, {len(negatives)} negative).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
