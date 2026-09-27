#!/usr/bin/env python3
"""Detection-as-Code test gate for the Sigma rule library.

Positive tests: every rule in sigma/rules/ must PASS `sigma check`
                AND convert cleanly with `sigma convert -t splunk -p splunk_windows`.
Negative tests: every rule in tests/sigma/negative/ must FAIL `sigma check`
                (current pySigma also reports undefined conditions in `check`
                as condition errors; the convert stage stays in the loop as
                defense in depth).

Exit codes: 0 = all tests passed, 1 = at least one failure.
Usage:      python tests/test_sigma.py        (requires: pip install sigma-cli pySigma-backend-splunk)
"""
import shutil
import subprocess
import sys
from pathlib import Path

RULES_DIR = Path("sigma/rules")
NEGATIVE_DIR = Path("tests/sigma/negative")

# Conversion target. pySigma-backend-splunk requires an explicit processing
# pipeline for conversion; `splunk_windows` ships with the backend itself and
# matches this library's Windows process_creation rules. If you ever add
# rules for other platforms, extend this (see `sigma list pipelines splunk`).
CONVERT_ARGS = ["-t", "splunk", "-p", "splunk_windows"]

SIGMA = shutil.which("sigma")
if SIGMA is None:
    sys.exit("'sigma' not found on PATH - activate the .venv first "
             "(see sigma/README.md) or let CI run the gate.")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def list_rules(directory):
    return sorted(p for p in directory.rglob("*.yml") if p.is_file())


def main():
    failures = []
    positives = list_rules(RULES_DIR)
    negatives = list_rules(NEGATIVE_DIR)

    if not positives:
        failures.append("No rules found in sigma/rules/ - add at least one rule.")

    print(f"POSITIVE tests: {len(positives)} rule(s) must validate AND convert")
    for rule in positives:
        chk = run([SIGMA, "check", rule.as_posix()])
        if chk.returncode != 0:
            failures.append(f"CHECK FAILED (should pass): {rule.as_posix()}\n{chk.stdout}{chk.stderr}")
            print(f"  [FAIL] {rule.name} (check)")
            continue
        conv = run([SIGMA, "convert"] + CONVERT_ARGS + [rule.as_posix()])
        if conv.returncode != 0 or not conv.stdout.strip():
            failures.append(f"CONVERT FAILED (should succeed): {rule.as_posix()}\n{conv.stdout}{conv.stderr}")
            print(f"  [FAIL] {rule.name} (convert)")
        else:
            print(f"  [PASS] {rule.name}")

    print(f"NEGATIVE tests: {len(negatives)} broken rule(s) must be REJECTED by the gate")
    for rule in negatives:
        chk = run([SIGMA, "check", rule.as_posix()])
        if chk.returncode != 0:
            print(f"  [PASS] {rule.name} (rejected by sigma check, as expected)")
            continue
        # Defense in depth: if `check` ever lets a broken rule through
        # (e.g. a future pySigma relaxes condition validation), conversion
        # must still fail - otherwise the gate is not a gate.
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
    print(f"RESULT: all tests passed ({len(positives)} positive, {len(negatives)} negative).")
    return 0


if __name__ == "__main__":
    sys.exit(main())