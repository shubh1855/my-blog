---
title: "Oracle - Xploitathon CTF"
description: "Writeup for Oracle from Xploitathon."
date: 2026-03-06 14:45:00
cover: "/img/cover/writeups-mobile.webp"
categories:
  - [Writeups, Xploitathon CTF]
tags:
  - Xploitathon
  - Reverse Engineering
---

# Oracle

**Category:** Reverse Engineering  
**Difficulty:** Medium

## Challenge Overview

Oracle was an ELF reverse engineering challenge where the objective was to understand how the binary validated user input and recovered the embedded flag. Rather than brute-forcing the correct input, the intended solution was to reverse the decoding routine used after a successful hash check.

## Approach

### Understanding the Validation Logic

After loading the binary into a disassembler, the input validation routine became clear:

- Read user input using `fgets()`
- Strip the trailing newline
- Require an input length of exactly 19 characters
- Compute a polynomial rolling hash
- Compare the result against the constant `0x9CFB3CEB`

Only matching inputs reached the flag decoding function.

### Inspecting the Decoder

Tracing the success path revealed another function responsible for reconstructing the flag from encoded bytes stored in the `.rodata` section.

The decoding formula was:

```c
output[i] = ((hash >> (i & 7)) ^ encoded[i] ^ (i * 31) ^ 0x5A) & 0xFF;
```

Since both the target hash and the encoded bytes were available in the binary, there was no need to recover the original input string.

### Recovering the Flag

Instead, I extracted the encoded data directly from the binary and reproduced the decoding routine in Python.

```python
import os

def solve():
    file_path = "oracle"
    if not os.path.exists(file_path):
        print(f"[-] Error: '{file_path}' not found in the current directory.")
        return
        
    hash_val = 0x9CFB3CEB
    encoded_vaddr = 0x402030
    base_addr = 0x400000 # Standard 64-bit ELF base address
    file_offset = encoded_vaddr - base_addr # Should be 0x2030
    num_bytes = 34
    
    try:
        with open(file_path, "rb") as f:
            f.seek(file_offset)
            encoded_data = f.read(num_bytes)
            
        if len(encoded_data) < num_bytes:
            print("[-] Error: Not enough bytes read. Check file offset.")
            return
            
        print("[+] Encoded bytes extracted successfully.")
        flag = ""
        
        for i in range(num_bytes):
            shifted_hash = hash_val >> (i & 7)
            dec_byte = (shifted_hash ^ encoded_data[i] ^ (i * 31) ^ 0x5A) & 0xFF
            flag += chr(dec_byte)
            
        print(f"\n[+] Decoded Flag: {flag}")
    except Exception as e:
        print(f"[-] An error occurred: {e}")

if __name__ == "__main__":
    solve()
```

Running the script reconstructed the plaintext flag immediately.

![Final Flag](/img/posts/fsociety-oracle.webp)

```text
XPL8{c0ntr0l_1s_th3_r34l_1llu510n}
```

## Conclusion

Oracle demonstrates a common reverse engineering lesson: passing validation is not always necessary. Once the decoding algorithm and encoded data were identified, recreating the routine externally was significantly easier than finding a valid input that satisfied the hash check.

```text
Flag:
XPL8{c0ntr0l_1s_th3_r34l_1llu510n}
```
