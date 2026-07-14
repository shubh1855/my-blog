---
title: "RAIT-CTF Sanity Check – Core Team Signal"
description: "Writeup for RAIT-CTF Sanity Check – Core Team Signal from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups, RAIT-CTF 2026 Finals]
tags:
  - RAIT-CTF
  - Misc
---

# RAIT-CTF Sanity Check – Core Team Signal

**Flag:** `RAIT-CTF{S4NI7Y_CH3CK_7HR0UGH_C0R3_734M_D0N3}`

## Approach (Step by Step)

### 1. OSINT Collection

By performing basic recon on the RAIT-CTF Core Team, we can find Base64 fragments hidden inside the LinkedIn biographies of four members (Harsh, Chandan, Mrridul, Hrishraj):

1. `UGFydDE6IFJBSVQtQ1RGe1M0`
2. `UGFydDI6IE5JN1lfQ0gzQ0s=`
3. `UGFydDM6IF83SFIwVUdIX0Mw`
4. `UGFydDQ6IFIzXzczNE1fRDBOM30=`

### 2. Decoding the Fragments

Decoding each Base64 fragment gives us the labelled parts of the flag:

```text
UGFydDE6IFJBSVQtQ1RGe1M0
→ Part1: RAIT-CTF{S4

UGFydDI6IE5JN1lfQ0gzQ0s=
→ Part2: NI7Y_CH3CK

UGFydDM6IF83SFIwVUdIX0Mw
→ Part3: _7HR0UGH_C0

UGFydDQ6IFIzXzczNE1fRDBOM30=
→ Part4: R3_734M_D0N3}
```

### 3. Assembly

Putting Part 1 → Part 2 → Part 3 → Part 4 together in the correct order gives us the final flag:

`RAIT-CTF{S4NI7Y_CH3CK_7HR0UGH_C0R3_734M_D0N3}`
