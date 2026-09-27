# ATT&CK Knowledge Platform

![Sigma validation](https://github.com/Souhaieb-Marzouk/attack-knowledge-platform/actions/workflows/sigma-validate.yml/badge.svg)
![Site](https://img.shields.io/website?url=https%3A%2F%2FSouhaieb-Marzouk.github.io%2Fattack-knowledge-platform%2F)
![License](https://img.shields.io/badge/license-MIT-blue)

> In-Depth MITRE ATT&CK Technique Explanations, wired together with a validated
> Sigma rule library, global search, and a detection-as-code CI gate.

**Live site:** https://souhaieb-marzouk.github.io/attack-knowledge-platform/

![Coverage matrix](assets/img/screens/social.png)

*The 14-tactic coverage matrix on the home page — live guides filled, planned outlined.*

## What is this?

An unofficial, educational knowledge base for MITRE ATT&CK®. Every technique
guide is explained in-depth - attack simulation, red-team view, blue-team
view, detection engineering, and a real-world case study - and every Sigma rule
is validated by CI with positive and negative tests before it ships.

## Features

- **Ctrl+K global search** across techniques, actors, mitigations, campaigns
  and Sigma rules - inverted index, ranked results, full keyboard navigation.
- **ATT&CK matrix heatmap** on the home page: 14 tactic columns rendered from
  the JSON data layer, live vs planned at a glance.
- **Cross-linked navigation** on every technique page: breadcrumbs, relations
  (used by / mitigated by / detected by) and prev/next within the tactic.
- **Sigma Rule Library** with level badges, tactic and logsource filters, and
  one-click Copy YAML.
- **Detection-as-code CI** on GitHub Actions: pySigma validation with positive
  AND negative test gates, auto-generated rule index committed back to main.
- Platform baseline: dark/light theme with no-flash boot, responsive to 360 px,
  semantic HTML + keyboard support, smart search-first 404, SEO/OG tags,
  sitemap, MIT license with ATT&CK attribution.

## Repo structure

```
├── index.html            # home + matrix heatmap
├── techniques/           # hand-written guides + hub + template
├── actors/ mitigations/ campaigns/ tools/
├── assets/               # css, js, images (no frameworks, no CDNs)
├── data/                 # JSON single source of truth (see data/README.md)
├── sigma/rules/          # validated detection rules
├── tests/                # positive + negative Sigma test gate
├── scripts/              # validators + index/link checkers
└── .github/workflows/    # CI pipeline
```

## Sigma testing policy

Every rule must pass the CI gate before merge: `sigma check` + clean conversion
to Splunk (positive tests), while four intentionally-broken rules in
`tests/sigma/negative/` must be rejected (negative tests) — proving the gate
actually gates. A free local fallback is documented in
[`sigma/README.md`](sigma/README.md).

## FAQ

- **Why no framework?** Static files served raw are the fastest, cheapest, most
  durable hosting model for this content — and the constraint that makes the
  zero-dependency engineering story interesting. A future migration path to a
  static generator is noted, but nothing needs it today.
- **Is the CI really free?** Yes — GitHub Actions grants public repositories
  unlimited minutes on standard hosted runners. The pipeline installs a pinned
  Python toolchain on every run for reproducibility.
- **Is this official MITRE content?** No. See attribution below.

## Attribution

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. This project
is unofficial and educational; technique identifiers and descriptions reference
the public MITRE ATT&CK knowledge base (mitre/cti) and are used with
attribution. Content on this site is the author's own analysis and does not
represent MITRE.

## License

MIT — see [LICENSE](LICENSE).