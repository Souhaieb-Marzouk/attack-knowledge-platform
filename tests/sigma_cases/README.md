# Sigma log test cases

Each folder is named after a rule (`sigma/rules/<stem>.yml`) and contains:

- `positive.jsonl` — one or more log events that MUST match the rule.
- `negative.jsonl` — one or more real-shaped events that MUST NOT match.

`tests/test_sigma.py` reads them, evaluates the rule with
`tests/sigma_match.py`, and fails if the positive case misses or the negative
case matches. `index.json` maps every rule to its guide and fixtures;
`thresholds.json` holds the SIEM-side count/sum/near metadata for rules that
cannot express aggregation in portable Sigma.

## Important: what "real" means here

These are **realistic event shapes**, not production captures: Sysmon event 1,
Windows Security 4624/4684/5145, auditd EXECVE, CloudTrail, Entra sign-in,
M365 audit, Okta system log, Zeek `dns.log`/`conn.log`, pfSense filterlog,
Apache access and BIND query records. They are safe, reproducible and
reviewable in a pull request.

For an environment-specific test, replace the JSONL with an export from your
lab or SIEM. Keep secrets and personal data out of the repository. If your
event uses different field names, add a field mapping to the harness rather
than weakening the rule.

## Adding a case

1. Create the folder with the exact rule stem.
2. Put at least one matching event in `positive.jsonl`.
3. Put at least one benign event in `negative.jsonl`; ideally it differs from
   the positive case in only one meaningful field.
4. If the rule is an aggregation, add its metadata to `thresholds.json`.
5. Run `python tests/test_sigma.py`.

The generator at `generate_fixtures.py` can create a first draft from the
rule's detection fields. Always review the generated values before committing.
