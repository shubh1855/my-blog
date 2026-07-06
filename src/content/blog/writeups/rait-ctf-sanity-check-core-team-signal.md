---
title: "RAIT-CTF Sanity Check – Core Team Signal"
description: "Writeup for RAIT-CTF Sanity Check – Core Team Signal from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - CTF
  - Writeups
tags:
  - RAIT-CTF
  - Misc
---

# RAIT-CTF Sanity Check – Core Team Signal

Flag: RAIT-CTF{S4NI7Y_CH3CK_7HR0UGH_C0R3_734M_D0N3}

Approach (Step by Step):

1.  UGFydDE6IFJBSVQtQ1RGe1M0
2.  UGFydDM6IF83SFIwVUdIX0Mw
3.  UGFydDQ6IFIzXzczNE1fRDBOM30=
4.  UGFydDI6IE5JN1lfQ0gzQ0s=

Got fragments from Harsh, Chandan, Mrridul, Hrishraj linkedin Bio

Decoding each Base64 fragment
   UGFydDE6IFJBSVQtQ1RGe1M0
→ Part1: RAIT-CTF{S4
   UGFydDI6IE5JN1lfQ0gzQ0s=
→ Part2: NI7Y_CH3CK
   UGFydDM6IF83SFIwVUdIX0Mw
→ Part3: _7HR0UGH_C0


   UGFydDQ6IFIzXzczNE1fRDBOM30=
→ Part4: R3_734M_D0N3}
Assembling in correct order
Putting Part1 → Part2 → Part3 → Part4 together:

RAIT-CTF{S4NI7Y_CH3CK_7HR0UGH_C0R3_734M_D0N3}

RAIT-CTF Final Round Report
