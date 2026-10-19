# Contributing

This is a small, static knowledge platform. Contributions are welcome, but the
quality gates are strict: a page or rule that is not wired into the data layer
and the test suite will not merge.

## Workflow A — add or promote a technique guide

1. Create the page from [`techniques/_template.html`](techniques/_template.html).
   Keep the platform integration block. Use a lowercase, hyphenated folder for
   a technique family, with numeric subpages, for example:
   `techniques/T1566-phishing/001-spearphishing-attachment.html`.
2. In [`data/techniques.json`](data/techniques.json), set the row to
   `"status": "implemented"` and add the **case-exact** `"page"` path. Remove
   the `page` field from any planned row; never create empty placeholder HTML.
3. Link the rules that detect it in the row's `"sigma"` array.
4. Add a meta description, canonical URL and `data-technique="TXXXX.XXX"`.
5. Run:

   ```powershell
   py scripts/validate_data.py
   py scripts/check_links.py
   py scripts/check_site.py
   ```

6. Test the page from the matrix, the techniques hub, global search and the
   prev/next footer. All four must land on the new page.

## Workflow B — add a Sigma rule

1. Read the style guide in [`sigma/README.md`](sigma/README.md).
2. Put the rule in `sigma/rules/` using
   `t{technique-id-lowercase}-{slug}.yml`.
3. Add the rule path to the technique row's `"sigma"` array.
4. Create the two log fixtures in `tests/sigma_cases/<rule-stem>/`:
   - `positive.jsonl`: event(s) that must match.
   - `negative.jsonl`: real-shaped event(s) that must not match.
   You can start from `python tests/sigma_cases/generate_fixtures.py`, then
   replace the generated values with exports from a lab or a public sample.
5. If the rule uses a count/sum/near threshold, add the metadata to
   `tests/sigma_cases/thresholds.json`.
6. Run:

   ```powershell
   py scripts/build_sigma_index.py
   py tests/test_sigma.py
   ```

7. Add a false-positive entry to `data/fp-gallery.json` when you know a
   benign trigger.

## Quality gates

Every PR must pass:

- `scripts/validate_data.py` — JSON, case-exact paths, non-empty integrated
  pages, relations.
- `scripts/check_links.py` — every static `href`/`src`.
- `scripts/check_site.py` — sitemap, README images, placeholders, 15-tactic
  copy.
- `tests/test_sigma.py` — `sigma check`, Splunk conversion, positive and
  negative log fixtures, and the four deliberately broken negative rules.

## Style contract

- English at CEFR B1 for explanations: short sentences, define a term once.
- Every technique page has: simulation, red view, blue view, detection
  engineering, real-world case, mitigation, common mistakes.
- Sigma rules are detection-as-code: UUID, references, technique tag, level,
  false positives, and a log test.
- Do not commit generated caches, `.venv`, or empty HTML files.

## Pull request checklist

- [ ] Data validator, link checker and site checker pass.
- [ ] Sigma suite passes, including positive/negative logs.
- [ ] New page appears in the matrix, hub, search and prev/next.
- [ ] Light and dark theme both checked at 360 px and 1440 px.
- [ ] README/attribution updated if the public counts changed.
- [ ] No placeholders (`{{...}}`, `example.com` in metadata, `TODO`).

## Attribution

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. This project
is unofficial and educational; see [`NOTICE`](NOTICE).
