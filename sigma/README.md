# Sigma rules

Detection-as-code rules for the knowledge base. Every rule in
`sigma/rules/` is validated by CI and is browsable in the
[Sigma Rule Library](../tools/sigma.html). Every rule also has a positive and
a negative JSONL log fixture under `tests/sigma_cases/`.

**Current library: 245 rules, 245 positive cases, 245 negative cases.**

## Style guide

New rules start as `experimental` and can be promoted after tuning.

- **Filename:** `t{technique-id-lowercase}-{slug}.yml` — for example
  `t1566.001-outlook-child-process.yml`. Always `.yml`, never `.yaml`.
- **Required fields:** `title`, `id` (UUID v4), `status` (`experimental` | `stable` | `test`),
  `description`, `references` (must include the attack.mitre.org technique
  URL), `author`, `date` (ISO `YYYY-MM-DD`), `tags` (at least one
  `attack.tXXXXXX` technique tag), `logsource`, `detection`, `falsepositives`,
  `level`.
- **Tactic tags use dashes:** `attack.initial-access`,
  `attack.privilege-escalation`, `attack.command-and-control`.
- **One rule = at least one technique tag.** The library map is generated from
  those tags and from the technique row's `sigma` array.
- **Level policy:** `high` for near-certain malicious behavior, `medium` for
  suspicious-but-confirmable, `low` for behavioral context worth logging.

## The three-layer test gate

`tests/test_sigma.py` runs for every rule:

1. **Schema** — `sigma check` accepts the rule.
2. **Conversion** — `sigma convert -t splunk -p splunk_windows` produces output.
3. **Logs** — `tests/sigma_match.py` evaluates the rule against:
   - `tests/sigma_cases/<rule-stem>/positive.jsonl` — must match at least one event;
   - `tests/sigma_cases/<rule-stem>/negative.jsonl` — must match no event.

The four deliberately broken rules in `tests/sigma/negative/` must still be
rejected, proving the gate is not a rubber stamp.

### Aggregate rules

Modern Sigma cannot validate the old
`selection | count() by field > N` pipe syntax. The library keeps the portable
event-level rule and moves the threshold to
`tests/sigma_cases/thresholds.json`:

```json
{
  "sigma/rules/t1590.004-horizontal-sweep-across-external-range.yml": {
    "kind": "count",
    "field": "",
    "group_by": ["src_ip"],
    "operator": ">",
    "value": 25,
    "timespan": "5m",
    "original_condition": "selection | count(distinct dst_ip) by src_ip > 25"
  }
}
```

The rule description says the threshold belongs in the SIEM; the log harness
counts the fixture events and applies the comparison. This is the same split a
real detection team uses: Sigma for the event, SIEM for the aggregation.

### Fixture shape

```jsonl
{"@timestamp":"2026-10-19T08:30:00Z","Channel":"Security","EventID":4688,"Image":"C:\\Windows\\System32\\cmd.exe","CommandLine":"cmd.exe /c whoami","ParentImage":"C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE"}
```

Fixtures are realistic event shapes (Sysmon, Windows Security, auditd/auth,
CloudTrail, Entra ID, M365, Okta, Zeek, pfSense, Apache, BIND), not production
captures. Replace or extend them with exports from your own lab; the harness is
schema-agnostic JSONL.

## Generate or refresh fixtures

The generator is deterministic and safe to re-run. It derives a matching event
from each rule's selection fields, then mutates the negative case so it cannot
match:

```powershell
py tests/sigma_cases/generate_fixtures.py
```

Then run the gate:

```powershell
.venv\Scripts\activate
pip install sigma-cli pySigma-backend-splunk pyyaml
python tests/test_sigma.py
python scripts/build_sigma_index.py
```

## How the library page and index are generated

`scripts/build_sigma_index.py` reads every `sigma/rules/*.yml` and writes
`data/sigma-index.json` (metadata only — title, id, level, status, logsource,
tactics, techniques, author, date). CI regenerates and commits the index on
every push that changes a rule; never hand-edit it.

## Attribution

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. This project
is unofficial and educational; technique identifiers reference the public MITRE
ATT&CK knowledge base and are used with attribution. See [`NOTICE`](../NOTICE).
