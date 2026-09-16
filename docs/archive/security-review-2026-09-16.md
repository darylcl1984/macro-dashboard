# Security review — 16 September 2026

Reviewed the current frontend, service worker, Python import/refresh scripts,
dependency requirements, and GitHub Actions workflows. Changes are local.

## Findings and fixes

1. **HTML injection in regional reporting dates.** `render()` interpolated
   `latest.period` from the money-history snapshot into two HTML sinks without
   escaping it. A poisoned snapshot could insert an event-handler payload into
   the dashboard. Both the regional rows and total now escape the period.
   The regression test renders a real snapshot with a malicious period and
   verifies that both outputs contain inert text.

2. **Unsafe benchmark source and licence links.** HTML escaping did not restrict
   URL schemes in benchmark links. A poisoned snapshot could supply a
   `javascript:` or `data:` destination. A shared link renderer now parses URLs,
   allows only absolute HTTP(S) links without embedded credentials, escapes
   the resulting attribute and label, and renders rejected links as plain text.
   Tests cover mixed-case and control-character obfuscation, malformed URLs,
   credential-bearing URLs, both benchmark links, and ordinary source links.
   These data-rendering findings require control of a served snapshot; this
   review found no public endpoint that lets visitors write those snapshots.

3. **Vulnerable dependency versions permitted.** The old `requests>=2.31.0`
   requirement permitted versions with published security advisories and did
   not require a patched urllib3. Local test dependencies contained urllib3
   2.7.0. Requirements now specify `requests>=2.33.0,<3` and
   `urllib3>=2.8.0,<3`; the existing local urllib3 installation was upgraded.
   These are dependency findings, not evidence that every advisory's exploit
   conditions apply to this dashboard. References:
   [Requests advisory](https://github.com/psf/requests/security/advisories/GHSA-gc5v-m9x4-r6x2)
   and [urllib3 2.8.0 security fixes](https://github.com/urllib3/urllib3/releases/tag/2.8.0).

Additional hardening: the test workflow now explicitly requests read-only
repository access and disables checkout credential persistence. The refresh
workflow retains the write permission it needs to publish validated data.
Frontend cache and asset versions were advanced together from 92 to 93.

## Validation and limits

- 25 Python tests and 31 JavaScript tests passed, including three new security
  regression tests. JavaScript syntax and diff whitespace checks passed.
- pip-audit 2.10.1 reported no known vulnerabilities for the complete resolved
  runtime dependency set: requests 2.34.2, urllib3 2.8.0, certifi 2026.7.22,
  charset-normalizer 3.5.1, and idna 3.19.
- A pattern scan of 55 tracked text files found no common credential patterns.
  It did not read local secret files or scan Git history and is not a guarantee
  that no secrets exist.
- No browser QA or production penetration testing was performed. Remote
  repository settings and deployment response headers were not inspected.
  No commit, push, or deployment was performed.
