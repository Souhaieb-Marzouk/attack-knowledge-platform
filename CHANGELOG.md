# Changelog

## Unreleased — 2026-10-20

### Added

- 56 new technique guides covering T1584, T1585, T1586, T1587, T1589, T1591,
  T1593, T1594, T1595, T1596, T1597, T1598 and T1681–T1683, including 41
  sub-techniques.
- 56 new Sigma rules extracted from the new detection sections, with 56
  positive and 56 negative log fixtures.
- Canonical URLs for every newly added guide.
- The new guides are wired into the technique catalogue, sitemap, search,
  hub pages and ATT&CK Explorer.
- Rebuilt `data/sigma-index.json` to 197 rules and updated library statistics.

### Changed

- Set all 197 Sigma rules to author `Souhaieb Marzouk`, status
  `experimental`, and practical descriptions and tuning notes.
- Normalized every rule description to one physical YAML line.

### Fixed

- Renamed the earlier batch of new sub-technique pages to `00N-Name.html` and
  updated the catalogue, sitemap, canonical URLs and internal links.
- Replaced legacy `*-v2.0.html` internal links with the real page paths.
- Updated README live-guide counts from 20 to 76.

## v1.2 — 2026-10-19

### Changed

- Replaced the flat 597-tile coverage matrix with a three-stage ATT&CK Explorer:
  tactic → technique → sub-technique, one branch open at a time.
- Added deep links (`#tactic=...&technique=...`), animated connector lines,
  focus preservation, keyboard-accessible buttons and mobile stacking.
- Updated the home page, README, screenshots and resume story around the new
  explorer.

## v1.1 — 2026-10-19

### Added

- 136 Sigma rules extracted from the hand-written guides (141 total).
- A positive and a negative JSONL log fixture for every rule (282 cases).
- `tests/sigma_match.py`, a dependency-free evaluator for the supported Sigma
  subset, including count/sum/near threshold metadata.
- `tests/sigma_cases/generate_fixtures.py` and per-rule case folders.
- `scripts/check_site.py`: sitemap, README/assets, placeholder and
  site-consistency gate.
- `docs/sigma-rule-guide.html`: standalone Sigma authoring and testing guide.
- `CONTRIBUTING.md`, `RESUME.md`, issue forms and a PR template.
- Live/full-catalogue toggles for the explorer and techniques hub.
- Social preview card and refreshed screenshots.

### Changed

- 582 empty placeholder HTML pages removed; planned rows no longer carry a
  `page`.
- 20 real guides (two hidden parent guides promoted), 15 tactics, and
  597 catalogue rows.
- Strict validator: case-exact paths, non-empty integrated pages, planned rows
  without a page.
- CI runs on every push/PR, not only Sigma/data paths.
- Global search ranks live guides above planned rows and understands bare
  numeric IDs.
- Theme handling unified on `atk-theme`; all guides load `platform.js` and
  declare `data-technique`.
- `v1.0` release notes replaced by this changelog; repository metadata points
  at the live site.

### Fixed

- 19 latent data-path case mismatches (T1566/T1590/T1134 families).
- `404.html` canonical placeholder; sitemap missing guide URLs; missing
  `social.png`; README screenshot path.
- T1134.001 browser-extension CSP and `example.com` metadata.
- T1566.001 relations/prev-next placement below the footer.
- Broken “full-rule viewer” claim on the tools page.
