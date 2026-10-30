---
link: 'writeups/kpmg-ctf-2026/onion-layers'
title: "Onion Layers - KPMG CTF 2026"
description: "Writeup for Onion Layers from KPMG CTF 2026. Peeling through nested encoding layers including binary representation, Base64, hex encoding, and an Atbash cipher."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Crypto
  - Encoding
  - CyberChef
  - Atbash
---

# KPMG CTF 2026 - Onion Layers

---

## Challenge Description

> An encrypted payload named `chall.enc` was discovered. Like an onion, secrets have layers. Peel away each layer to recover the flag.

---

## Step 1 - Inspecting the Challenge File

Opening `chall.enc` revealed a continuous sequence of 8-bit space-delimited binary strings:

```text
01001110 01010100 01000001 00110000 01011001 01101010 01010010 01101100 ...
```

There were 104 binary octets in total.

---

## Step 2 - Decoding the Layers

We loaded the ciphertext into CyberChef to peel each encoding stage:

### Layer 1: From Binary

Converting the space-delimited binary octets to ASCII characters produced a 104-character string:

```text
NTA0YjRlNTQ1ZjU4NDc1NTdiNmIzMzMzNmY1ZjY3NzMzNTZmNmIzMzM1NjY1ZjY3MzMzNTZmNmYzNDYyMzM2OTY4NWY2ZjMxNzA2MzM1NWY2NDZkNWY2MzZkMzE2MDZkN2Q=
```

The character set and trailing `=` padding clearly indicated standard Base64 encoding.

### Layer 2: From Base64

Decoding the Base64 layer yielded a 78-character ASCII hexadecimal string:

```text
504b4e545f5847557b6b33336f5f6773335f6f34623369685f6f3170335f346d5f306d31306d7d
```

### Layer 3: From Hex

Decoding the hex representation revealed an obfuscated flag structure:

```text
PKNT_XGU{k33o_gs3_o4b3ih_o1p3_4m_0m10m}
```

Notice the prefix `PKNT_XGU` matching the format of `KPMG_CTF`.

### Layer 4: Atbash Cipher

Comparing `PKNT_XGU` to `KPMG_CTF`:
- `P` (16th letter) aligns with `K` (11th letter: `27 - 16 = 11`)
- `K` (11th letter) aligns with `P` (16th letter)
- `N` (14th letter) aligns with `M` (13th letter: `27 - 14 = 13`)
- `T` (20th letter) aligns with `G` (7th letter: `27 - 20 = 7`)

This is the classic Atbash substitution cipher, where each alphabet letter is mirrored across the alphabet (`A <-> Z`, `B <-> Y`, `C <-> X`). Non-alphabetic characters and digits remain unchanged.

Applying the Atbash transform yielded the flag:

```text
KPMG_CTF{p33l_th3_l4y3rs_l1k3_4n_0n10n}
```

![CyberChef solve pipeline](/img/posts/kpmg-ctf-2026-95_crypto_onion_cyberchef.webp)

---

## Solve Script

The entire decoding pipeline can be executed in Python:

```python
import base64

def atbash(s: str) -> str:
    res = []
    for c in s:
        if 'a' <= c <= 'z':
            res.append(chr(ord('z') - (ord(c) - ord('a'))))
        elif 'A' <= c <= 'Z':
            res.append(chr(ord('Z') - (ord(c) - ord('A'))))
        else:
            res.append(c)
    return ''.join(res)

with open('chall.enc', 'r') as f:
    raw = f.read().strip()

# Layer 1: Binary to ASCII
layer1 = bytes(int(b, 2) for b in raw.split()).decode()

# Layer 2: Base64 to Hex string
layer2 = base64.b64decode(layer1).decode()

# Layer 3: Hex to string
layer3 = bytes.fromhex(layer2).decode()

# Layer 4: Atbash substitution
flag = atbash(layer3)

print("Flag:", flag)
```

---

## Flag

```plain
KPMG_CTF{p33l_th3_l4y3rs_l1k3_4n_0n10n}
```

---

## Summary

The challenge required recognizing cascading layers of data representation: binary octets -> Base64 string -> hexadecimal representation -> monoalphabetic Atbash substitution cipher. Reversing each step in order revealed the flag.
