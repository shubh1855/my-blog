---
link: 'writeups/kpmg-ctf-2026/troll-clock'
title: "Troll Clock - KPMG CTF 2026"
description: "Writeup for Troll Clock from KPMG CTF 2026. Intercepting WebSocket verification logic and reversing obfuscated JavaScript proxy calculations to extract the flag."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Web
  - WebSocket
  - Reverse Engineering
  - JavaScript Obfuscation
---

# KPMG CTF 2026 - Troll Clock

---

## Challenge Description

> Troll Clock claims to be a precision timekeeping service. Synchronize the clock, solve the server's verification challenge, and retrieve the flag.

---

## Step 1 - Intercepting the WebSocket Traffic

Opening the application in Burp Suite showed that it communicates via WebSockets rather than standard HTTP endpoints:

```text
wss://kicyber-d46e0ec3248f-trollclock-0-0.chals.io
```

When you click the synchronization button, the client sends a `clock_sync` frame. The server responds with an obfuscated JavaScript verification payload that the browser must execute to produce an answer token.

The UI displays an OTP field on the screen, but that value is cosmetic. The server expects an exact numeric answer calculated from the code challenge transmitted across the socket.

---

## Step 2 - Deobfuscating the Challenge Script

The server returned a self-contained JavaScript function packed with dead code, decoy variables, and misleading comments:

![Obfuscated troll challenge code in browser](/img/posts/kpmg-ctf-2026-70_troll_clock_browser.webp)

Key traps in the script:
- A `__trollBypass` condition that leads to a hardcoded fake answer
- A large `switch` statement with meaningless loop iterations
- Fake comments advising the analyst to ignore specific blocks

Cutting through the noise, the script constructs three JavaScript `Proxy` objects with custom `get` traps. Each proxy subtracts an offset when accessing `.v`:

```javascript
// Block 1
1267876 - 423971 = 843905

// Block 2
1760201 - 872908 = 887293

// Block 3
733419 - 177117 = 556302
```

The script then sums these three intermediate results:

```javascript
843905 + 887293 + 556302 = 2287500
```

Finally, it applies a modulo operation:

```javascript
2287500 % 1000000 = 287500
```

The expected answer for the verification window was **`287500`**.

---

## Step 3 - Submitting the Answer via WebSocket

Using Burp Suite's WebSocket Repeater, we crafted and sent the response frame:

```json
{
  "type": "submit_window",
  "answer": "287500"
}
```

![Submitting answer via Burp WebSocket Repeater](/img/posts/kpmg-ctf-2026-71_troll_clock_burp.webp)

The server immediately verified the calculation and returned the flag frame:

```json
{
  "origin": "http://localhost:3000",
  "type": "flag",
  "flag": "VqlB2-zqmRZKmPzT9U-okVIKRdHZnuXfH59WaxQXo7ft"
}
```

---

## Flag

```plain
KPMG_CTF{VqlB2-zqmRZKmPzT9U-okVIKRdHZnuXfH59WaxQXo7ft}
```

---

## Mitigations

| Vulnerability | Fix |
|---|---|
| Client-side verification | Never rely on client-evaluated scripts or proof-of-work puzzles for sensitive authorization |
| Security through obscurity | Obfuscation and dead-code insertion only delay reverse engineering; enforce validation on the server |

---

## Summary

Troll Clock attempted to deter automated solvers by serving dynamically generated JavaScript challenges over WebSockets. By inspecting the socket frames in Burp Suite and filtering out the control-flow flattening noise, we identified three proxy subtraction routines. Evaluating those operations and taking the modulo yielded the verification token, which returned the flag over the active socket.
