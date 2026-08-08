---
link: 'writeups/xploitathon/dark-army-terminal'
title: "Dark Army Terminal - Xploitathon CTF"
description: "Writeup for Dark Army Terminal from Xploitathon."
date: 2026-03-06 16:00:00
categories:
  - [Writeups, Xploitathon CTF]
tags: [Xploitathon, Crypto]
---

# Dark Army Terminal

**Category:** Cryptography

## Challenge Overview

Dark Army Terminal was a straightforward AES challenge where the clues hinted at the encryption mode and key derivation method.

## Approach

The phrase _"sixteen at a time"_ suggested AES block encryption, while _"Dark Army never trusted raw secrets"_ implied the key should be hashed instead of used directly.

Using **SHA-256("whiterose")** produced a 256-bit AES key. Since no IV was provided, ECB mode was the obvious choice.

```python
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import hashlib

ciphertext_hex = (
    "67237bfd6285c6f75462094a1f1235c0218e39f9c0cf2a7a8a6954222dcd06cc"
)

ciphertext = bytes.fromhex(ciphertext_hex)

password = "whiterose"
key = hashlib.sha256(password.encode()).digest()

print(f"[] Password      : {password}")
print(f"[] Key (SHA256)  : {key.hex()}")
print(f"[] Ciphertext    : {ciphertext_hex}")
print(f"[] Key size      : {len(key) * 8} bits → AES-{len(key) * 8}")

cipher = Cipher(
    algorithms.AES(key),
    modes.ECB(),
    backend=default_backend(),
)

decryptor = cipher.decryptor()
raw = decryptor.update(ciphertext) + decryptor.finalize()

# Remove PKCS#7 padding if present
pad_len = raw[-1]

if 1 <= pad_len <= 16 and raw[-pad_len:] == bytes([pad_len] * pad_len):
    flag = raw[:-pad_len].decode("utf-8")
else:
    flag = raw.decode("utf-8")

print(f"\n[+] FLAG: {flag}")
```

After decrypting the ciphertext and removing PKCS#7 padding, the plaintext revealed:

![Final Flag](/img/posts/dark_army_terminal.webp)

```text
XPL8{LINUXPDF_MASTER}
```

## Conclusion

The challenge focused on interpreting cryptographic hints correctly rather than implementing complex attacks.
