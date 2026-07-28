---
title: "Ecorp Vault - Xploitathon CTF"
description: "Writeup for Ecorp Vault from Xploitathon."
date: 2026-03-06 15:45:00
categories:
  - [Writeups, Xploitathon CTF]
tags: [Xploitathon, Crypto]
---

# Ecorp Vault

**Category:** Cryptography

## Challenge Overview

Ecorp Vault revolved around recovering a Triple-DES encrypted flag protected by a PIN-derived key. The intended solution was to brute-force the PIN efficiently rather than attack the encryption itself.

## Approach

The encrypted data used PBKDF2 with 500,000 SHA-256 iterations to derive an 8-byte DES key from the PIN. Since the PIN space was limited, the best approach was to brute-force it while parallelizing the workload across multiple CPU cores.

After deriving the candidate key, the parity bits required by DES were corrected before performing the manual Triple-DES decryption stages. The ciphertext was decrypted using the recovered PIN-derived key followed by the two hardcoded keys present in the challenge.

When the plaintext contained the expected `XPL8{...}` format, the correct PIN had been found.

```text
XPL8{d3cryp7_n07_3ncryp7_eqjvzv}
```

## Conclusion

This challenge highlighted that a strong KDF cannot compensate for a very small password space. Efficient brute force combined with multiprocessing was enough to recover the flag.
