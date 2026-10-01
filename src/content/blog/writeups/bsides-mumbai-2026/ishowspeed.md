---
link: "writeups/bsides-mumbai-2026/ishowspeed"
title: "Ishowspeed - BSides Mumbai CTF 2026"
description: "Writeup for Ishowspeed from BSides Mumbai CTF 2026."
date: 2026-10-01 15:00:00
categories:
  - [Writeups, BSides Mumbai CTF]
tags:
  - BSides Mumbai CTF
  - Cryptography
  - Rosicrucian Cipher
  - Base65536
  - Vigenere Cipher
---

# BSides Mumbai CTF 2026 — Ishowspeed

## Challenge Description

> We are provided with two files. One is a secret.txt with some unicode chars and a vector.png with some symbols.

---

## Step 1 — Reconnaissance

The challenge provides two files:

1. `vector.png` containing some symbols.
2. `secret.txt` containing weird Chinese-like unicode characters.

---

## Step 2 — Decrypting the PNG (Rosicrucian Cipher)

An image search on the symbols in `vector.png` suggests it is related to the Pigpen cipher, but it is actually the **Rosicrucian Cipher**.

Using the `dcode.fr` Rosicrucian cipher decoder tool, we can extract the hidden text:

![Rosicrucian Cipher on dcode.fr](/img/posts/bsides-mumbai-2026-06_rosicrucian.webp)

The decrypted text gives us the key: `ETHEREALLOVESREVERSING`.

---

## Step 3 — Decrypting the TXT (Base65536)

The `secret.txt` contains unicode text that looks like Chinese characters. This is indicative of **Base65536** encoding.

![Base65536 Decoder](/img/posts/bsides-mumbai-2026-05_base65536.webp)

Decoding the Base65536 text gives us a string formatted like a flag:

```text
Fkzhzw_Dmuogm{is5_E1_1_e33h_ts15_xm_h0q_c1ehv_l0d3dmfy}
```

---

## Step 4 — Exploit (Vigenere Cipher)

We have a ciphertext that looks like the flag and a key `ETHEREALLOVESREVERSING`. Attempting a standard Vigenère decryption with this key results in random text.

Knowing that the flag format starts with `Bsides_Mumbai`, we can use a known-plaintext attack to see how the Vigenère key aligns with the ciphertext.

This reveals that the key is actually rotated by 12 characters!
The correct key is: `ESREVERSINGETHEREALLOV`.

Using this rotated key to decrypt the Base65536 output using the Vigenère cipher:

![Vigenere Decoder](/img/posts/bsides-mumbai-2026-07_vigenere.webp)

---

## Flag

```plain
Bsides_Mumbai{pl5_A1_1_n33d_th15_my_m0m_k1nda_h0m3less}
```

---

## Summary

This cryptography challenge involved a multi-stage decoding process: identifying a Rosicrucian cipher from an image to obtain a key, decoding Base65536 text to get a Vigenère ciphertext, and finally determining a rotated Vigenère key using a known-plaintext attack to extract the final flag.
