---
title: "RAIT-CTF Finals Crypto 1 - Secure Shell"
description: "Writeup for RAIT-CTF Finals Crypto 1 - Secure Shell from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups, RAIT-CTF 2026 Finals]
tags:
  - RAIT-CTF
  - Crypto
---

# RAIT-CTF Finals Crypto 1 - Secure Shell

**Flag:** `RAIT-CTF{crC32_1snT_4uTh_mY_dUd3}`

## Approach (Step by Step)

### 1. Connection and Bit-Flipping Exploit

To retrieve the flag, we need to bypass the security mechanism using a bit-flipping attack and a CRC mismatch leak. 
Run the below Python exploit script:

```python
from pwn import *
import binascii
import struct
import re

# Configuration
HOST = '34.0.14.121'
PORT = 9950

def xor_bytes(b1, b2):
    return bytes(a ^ b for a, b in zip(b1, b2))

def solve():
    # 1. Connect and Login
    r = remote(HOST, PORT)
    r.sendlineafter(b"User Login : ", b"user1")

    # 2. Inject the 'get_flag' command into history
    print("[*] Injecting target command...")
    r.sendlineafter(b"> ", b"3")
    r.sendlineafter(b"$ ", b"get_flag")
    r.recvuntil(b"OUT: Only Admin can run this")

    # 3. Retrieve the encrypted history entry
    r.sendlineafter(b"> ", b"2")
    r.recvuntil(b"[0] ")
    history_entry = r.recvline().strip().decode()

    print(f"[+] Encrypted History: {history_entry}")

    data = bytearray(binascii.unhexlify(history_entry))

    # 4. Perform Bit-Flipping on Ciphertext Block 0 to change 'guest' to 'admin'
    # 'guest' is at offset 10 inside the JSON payload.
    # JSON payload starts at Block 1.
    # To modify Block 1 plaintext, we XOR Block 0 ciphertext.
    # Block 0 starts at index 16 (first 16 bytes are IV).
    offset_in_block = 10
    block0_start = 16

    original_text = b"guest"
    target_text   = b"admin"
    xor_mask = xor_bytes(original_text, target_text)

    for i in range(len(xor_mask)):
        data[block0_start + offset_in_block + i] ^= xor_mask[i]

    # 5. Send the corrupted payload to leak the correct CRC
    bad_payload = binascii.hexlify(data).decode()

    r.sendlineafter(b"> ", b"4")      # Restore History
    r.sendlineafter(b">>> ", bad_payload.encode())

    r.sendlineafter(b"> ", b"3")      # Execute Command
    r.sendlineafter(b"$ ", b"!1")     # Execute index 0

    # Catch the error message
    response = r.recvline().decode().strip()

    if "Integrity Error" not in response:
        print(f"[-] Failed to trigger integrity error. Response: {response}")
        return

    print(f"[+] Leak received: {response}")

    # Regex parsing
    match = re.search(r"CRC Mismatch : (\d+) Expected (\d+)", response)
    if match:
        bad_crc = int(match.group(1))
        good_crc = int(match.group(2))
    else:
        print("[-] Could not parse CRC values.")
        return

    print(f"[+] Bad CRC: {bad_crc} | Target CRC: {good_crc}")

    # 6. Fix the IV to make the CRC match
    # The CRC is in the first 4 bytes of the plaintext.
    # P_0 = Decrypt(C_0) ^ IV.
    # We modify IV to force P_0 to be the correct CRC.
    bad_crc_bytes = struct.pack("<I", bad_crc)
    good_crc_bytes = struct.pack("<I", good_crc)

    crc_fix_mask = xor_bytes(bad_crc_bytes, good_crc_bytes)

    # Apply to the first 4 bytes (the IV)
    for i in range(4):
        data[i] ^= crc_fix_mask[i]

    final_payload = binascii.hexlify(data).decode()
    print(f"[+] Final Payload: {final_payload}")

    # 7. Send Final Payload and Get Flag
    r.sendlineafter(b"> ", b"4")      # Restore History
    r.sendlineafter(b">>> ", final_payload.encode())

    r.sendlineafter(b"> ", b"3")      # Execute Command
    r.sendlineafter(b"$ ", b"!1")     # Run it!

    # Interactive shell to view flag
    r.interactive()

if __name__ == "__main__":
    solve()
```

### 2. Result

Running the exploit modifies the token context to `admin` and repairs the CRC signature. The service will return the target flag:
`RAIT-CTF{crC32_1snT_4uTh_mY_dUd3}`
