# Sigma rules

Detection-as-code rules for the knowledge base. Every rule in
`sigma/rules/` is validated by CI (Phase 7) before it can land on
`main`, and is browsable on the
[Sigma Rule Library](../tools/sigma.html) page.

## Style guide

- **Filename pattern:** `t{technique-id-lowercase}-{slug}.yml`
  — e.g. `t1566.001-outlook-child-process.yml`. Always `.yml`,
  never `.yaml` (the CI globs and the index builder assume `.yml`).
- **Required fields:** `title`, `id` (a real UUID v4 — `sigma check`
  rejects malformed UUIDs), `status` (`stable` | `test` — the spec value is
  `test`, singular; `testing` is rejected by pySigma), `description`,
  `references` (must include the attack.mitre.org technique URL), `author`,
  `date` (ISO `YYYY-MM-DD`), `tags` (at least one `attack.tXXXXXX`
  technique tag), `logsource`, `detection`, `falsepositives`, `level`.
- **One rule = at least one technique tag.** A rule that maps to no
  technique does not belong in this library.
- **Tactic tag spelling:** dashes, not underscores — `attack.initial-access`,
  `attack.privilege-escalation`, `attack.command-and-control`. Current
  pySigma validators flag underscore spellings (`attack.initial_access`) as
  `InvalidATTACKTagIssue`; single-word tactics (`attack.execution`) are
  unaffected either way.
- **Level policy:** `high` for near-certain malicious behavior,
  `medium` for suspicious-but-confirmed-able, `low` for behavioral
  context worth logging.

## Testing policy

Every rule must pass the CI gate before merge (`.github/workflows/
sigma-validate.yml`):

- **Positive tests:** every rule in `sigma/rules/` must pass
  `sigma check` AND convert cleanly with
  `sigma convert -t splunk -p splunk_windows` (the pipeline ships with
  the backend; it is pinned in `CONVERT_ARGS` in `tests/test_sigma.py`).
- **Negative tests:** every intentionally-broken rule in
  `tests/sigma/negative/` must be REJECTED by the gate — this proves
  the gate actually gates.
- **Data integrity + internal links:** `scripts/validate_data.py` and
  `scripts/check_links.py` run in the same CI job (Phase 7).

Free local fallback (no CI needed):

```
# Windows (PowerShell):
py -m venv .venv
.venv\Scripts\activate
# macOS / Linux:
python3 -m venv .venv
source .venv/bin/activate
# then, on either OS:
pip install sigma-cli pySigma-backend-splunk pyyaml
python tests/test_sigma.py
```

## How the library page and index are generated

`scripts/build_sigma_index.py` reads every `sigma/rules/*.yml` and
writes `data/sigma-index.json` (metadata only — title, id, level,
status, logsource, tactics, techniques, author, date). CI regenerates
and commits the index on every push that touches `sigma/**` or
`tests/**`; locally, run the script by hand. Never hand-edit
`data/sigma-index.json`.

## Attribution

MITRE ATT&CK® is a registered trademark of The MITRE Corporation.
This project is unofficial and educational; technique identifiers
reference the public MITRE ATT&CK knowledge base and are used with
attribution.