---
title: "RAIT-CTF Finals Crypto 3 - Chain of Trust"
description: "Writeup for RAIT-CTF Finals Crypto 3 - Chain of Trust from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups, 周刊]
tags:
  - RAIT-CTF
  - Crypto
---

# RAIT-CTF Finals Crypto 3 - Chain of Trust

**Flag:** `RAIT-CTF{bl0ckch41n_b14s_l34ks_pr1v4t3_k3ys}`

## Approach (Step by Step)

### 1. Source Code Analysis

We check the source code provided to us and locate the following function:

```python
def _get_k(self, msg_hash_int):
    h = hashlib.sha256(self.secret_seed + int.to_bytes(msg_hash_int, 32, 'big')).digest()
    k = int.from_bytes(h[:30], 'big') # <--- The Flaw
    return k
```

We can see the nonce (`k`) being only 30 bytes instead of the usual 32. This makes it vulnerable because the nonce is biased. We can use the Hidden Number Problem (HNP) to solve it.

### 2. Interaction Script

We run a script to collect 20 signatures (`r_list`, `s_list`, and `z_list` values).

```python
from pwn import *
import hashlib
import json

# Connection
HOST = "34.0.14.121"
PORT = 9951
r = remote(HOST, PORT)

# 1. Capture the current session's Public Key
r.recvuntil(b"Public Key: ")
pubkey_raw = r.recvline().decode().strip()
print(f"Targeting Session Pubkey: {pubkey_raw}")

r_list = []
s_list = []
z_list = []

# 2. Collect 20 blocks
for i in range(20):
    r.sendlineafter(b"> ", b"1")
    r.sendlineafter(b"Enter data string: ", f"attack_{i}".encode())
    r.sendlineafter(b"> ", b"2")
    block = json.loads(r.recvline().decode())

    # Calculate z (the hash of the message signed)
    msg = f"{block['index']}{block['prev_hash']}{block['data']}".encode()
    z = int(hashlib.sha256(msg).hexdigest(), 16)

    r_list.append(block["r"])
    s_list.append(block["s"])
    z_list.append(z)
    print(f"Collected {i+1}/20", end="\r")

print("\n--- PASTE THESE INTO SAGE ---")
print(f"r_list = {r_list}")
print(f"s_list = {s_list}")
print(f"z_list = {z_list}")
print("-----------------------------")

# 3. KEEP CONNECTION OPEN
# This waits for you to calculate the r/s in Sage
r.interactive()
```

### 3. Lattice Attack using SageMath

Using the collected parameters, we can set up a lattice and use LLL to recover the private key:

```python
n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
B = 2^240
m = len(r_list)

M = Matrix(QQ, m + 2, m + 2)
for i in range(m):
    M[i, i] = n
    M[m, i] = (r_list[i] * inverse_mod(s_list[i], n)) % n
    M[m+1, i] = ((-z_list[i]) * inverse_mod(s_list[i], n)) % n

M[m, m] = B / n
M[m+1, m+1] = B

L = M.LLL()

priv_key = 0
for row in L:
    potential_d = abs(int(row[m] * n / B))
    if potential_d > 1 and potential_d < n:
        priv_key = potential_d
        print(f"--- RECOVERED NEW PRIVATE KEY ---\nd = {priv_key}\n")
        break

if priv_key:
    E = EllipticCurve(GF(2^256 - 2^32 - 977), [0, 7])
    G = E(0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798,
          0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8)
    
    msg = b"GIVE ME FLAG"
    z_flag = int(hashlib.sha256(msg).hexdigest(), 16)
    k_flag = 2
    
    k_point = k_flag * G
    r_flag = int(k_point.xy()[0]) % n
    s_flag = (inverse_mod(k_flag, n) * (z_flag + r_flag * priv_key)) % n
    
    print("--- SIGNATURE FOR THIS SESSION ---")
    print(f"r: {r_flag}")
    print(f"s: {s_flag}")
```

### 4. Retrieving the Flag

We can now use these generated `r` and `s` signature values to sign the `GIVE ME FLAG` payload. Passing this valid signature back to the service grants us the flag.
