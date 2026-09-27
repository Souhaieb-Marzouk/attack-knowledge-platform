# Contributing

Thanks for improving the ATT&CK Knowledge Platform. This project has two
kinds of contributions: **technique pages** (hand-written analysis) and
**Sigma rules** (validated detection logic). Both go through the same
data layer and the same quality gates.

## Adding a technique page

Technique pages are written by hand — the platform never generates
technique content. Workflow:

1. Copy `techniques/_template.html` to `techniques/TXXXX.XXX.html`
   (official ATT&CK casing — GitHub Pages is case-sensitive).
2. Paste your sections into the `MAIN CONTENT` block and replace every
   `{{TECHNIQUE_ID}}` / `{{TECHNIQUE_NAME}}` marker.
3. Make sure the platform integration block is present right after
   `<body>`:

```html
<!-- ==== PLATFORM INTEGRATION (paste right after <body>) ==== -->
<link rel="stylesheet" href="../assets/css/platform.css">
<div id="atk-header" data-technique="TXXXX.XXX"></div>
<script src="../assets/js/platform.js" defer></script>
<!-- ==== /PLATFORM INTEGRATION ==== -->
```

4. Add or update the row in `data/techniques.json`
   (`"status": "implemented"`, `"page": "techniques/TXXXX.XXX.html"`).
5. Run `python scripts/validate_data.py` — it must pass before you commit.

### Style contract

Your page's own styles always win inside your content. Platform styles
only touch `atk-*` classes and the injected chrome (header, footer,
breadcrumbs, relations, prev/next). If your page defines its own `--bg`
or other tokens, scope them to your content wrapper — the platform
tokens live on `:root` / `[data-theme="dark"]` and are only consumed by
`atk-*` components.

## Quality gates

- `python scripts/validate_data.py` — data integrity, must exit 0.
- `python tests/test_sigma.py` — Sigma validation (positive + negative),
  must exit 0 once Sigma rules exist (Phase 7 wires it into CI).

## Attribution

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. This
project is unofficial and educational; technique identifiers reference
the public MITRE ATT&CK knowledge base and are used with attribution.