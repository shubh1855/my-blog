---
title: "Deception Strategy"
description: "Detailed writeup for Deception Strategy from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-28
categories:
  - [Writeups, HTB Cyber Apocalypse CTF 2026: The Salt Crown]
tags:
  - HTB Cyber Apocalypse 2026
  - Malware Analysis
  - Reverse Engineering
  - Windows
  - CTF
---

# Malware Analysis Writeup – Investigating a Clipboard Stealer Disguised as a Discord DLL

## Challenge Overview

The challenge provides multiple forensic artifacts collected from a compromised Windows machine. The attacker replaced Discord's `d3d11.dll` with a malicious proxy DLL that silently monitored the user's clipboard, encrypted stolen data using RC4, and transmitted it to a remote command-and-control server.

The objective was to reconstruct the malware's behavior and answer several forensic questions by combining evidence from:

- Procmon logs
- Registry hives
- Network captures
- Static malware analysis

Unlike many traditional malware challenges, no single artifact contained every answer. Solving the challenge required correlating information across multiple sources.

---

# Files Provided

The challenge archive contained several artifacts.

```text
artifacts/
├── d3d11.dll
├── network.pcap
├── NTUSER.DAT
├── Logfile.PML
├── output.csv
└── ...
```

The most important files ended up being:

- `d3d11.dll`
- `network.pcap`
- `NTUSER.DAT`
- Procmon logs

---

# Understanding the Challenge

Reading the challenge description immediately reveals several important clues.

- Discord loads a suspicious DLL.
- Registry values are involved in encryption.
- Clipboard contents are stolen.
- Network traffic is captured.
- The malware uses RC4.

This immediately suggested that solving the challenge would require both forensic analysis and reverse engineering.

---

# Question 1 — Which process loaded the malicious DLL?

The first step was examining the Procmon logs.

Filtering the events by DLL load operations quickly revealed that the malicious DLL was loaded by:

```text
Discord.exe
```

Since the DLL was placed inside Discord's application directory, Windows loaded it instead of the legitimate Direct3D library.

**Answer**

```text
Discord.exe
```

---

# Question 2 — When was the DLL loaded?

Searching the Procmon events for the first successful load of `d3d11.dll` revealed the corresponding timestamp.

Converting it to Unix Epoch produced:

```text
1782570491
```

**Answer**

```text
1782570491
```

---

# Question 3 — Which exported function does the proxy DLL expose?

The malicious DLL impersonates the legitimate Direct3D library.

Running:

```bash
nm -C d3d11.dll
```

revealed the exported function:

```text
D3D11CreateDevice
```

Further inspection confirmed that this function serves as the malware's entry point while preserving compatibility with Discord.

**Answer**

```text
D3D11CreateDevice
```

---

# Question 4 — What mutex does the malware create?

While reversing the DLL, one of the first interesting imports was:

```text
CreateMutexW
```

Following the call inside `D3D11CreateDevice` eventually led to a UTF-16 string stored inside `.rdata`.

Dumping the relevant section:

```bash
objdump -s \
  --start-address=0x353ca1120 \
  --stop-address=0x353ca1180 \
  d3d11.dll
```

Produced:

```text
Local\DiscordRuntimeCache
```

The malware creates this mutex to ensure only a single instance executes at a time.

**Answer**

```text
Local\DiscordRuntimeCache
```

---

# Question 5 — Which 16-byte registry value is used for RC4 key derivation?

The malware stores a 16-byte session token inside the Windows Registry.

Examining the registry artifacts revealed:

```text
1aa3a658ce2c4a4258983eba1853f08c
```

Initially it appeared this value was the RC4 key itself.

However, reversing the malware later showed that the bytes are reversed before being passed into the RC4 routine.

Even though the malware internally reverses the value, the challenge specifically asks for the registry value.

**Answer**

```text
1aa3a658ce2c4a4258983eba1853f08c
```

---

# Question 6 — What MITRE ATT&CK technique describes the collection method?

The most useful function inside the malware was `RunWorker()`.

Ghidra produced a very readable decompilation:

```cpp
GetClipboardText();

if (clipboard_changed) {
    Rc4Crypt(...);
    SendTelemetry(...);
}
```

The malware continuously monitors clipboard contents, encrypts newly copied data, and transmits it to the remote server.

This behavior maps directly to the MITRE ATT&CK technique:

```text
T1115
```

Clipboard Data collection.

**Answer**

```text
T1115
```

---

# Question 7 — What is the IP address of the C2 server?

The supplied PCAP contains the malware's network traffic.

Inspecting the HTTP POST requests eventually revealed the remote endpoint used by the malware.

The destination IP was:

```text
203.49.53.184
```

This server receives encrypted clipboard contents from infected hosts.

**Answer**

```text
203.49.53.184
```

---

# Question 8 — What crypto wallet seed phrase was stolen?

This was the most involved part of the challenge.

Initially, the captured HTTP traffic appeared to contain only encrypted binary data.

Reverse engineering `RunWorker()` revealed why.

The malware performs the following steps:

1. Read the 16-byte session token.
2. Reverse the bytes.
3. Use the reversed token as the RC4 key.
4. Encrypt clipboard contents.
5. Send the encrypted blob to the C2.

The relevant call looked like:

```cpp
Rc4Crypt(ciphertext, clipboard, local_b8 + 0x10);

SendTelemetry(ciphertext);
```

Once the RC4 key derivation was understood, decrypting the captured payload revealed the clipboard contents.

Among the recovered data was the stolen cryptocurrency wallet recovery phrase:

```text
glow fix connect talon title risk barrel marine truth disease garbage cheese
```

**Answer**

```text
glow fix connect talon title risk barrel marine truth disease garbage cheese
```

---

# Malware Workflow

After reconstructing the malware's execution flow, its behavior becomes clear.

```text
Discord.exe
        │
        ▼
Loads malicious d3d11.dll
        │
        ▼
Creates mutex
(Local\DiscordRuntimeCache)
        │
        ▼
Reads / Generates session token
        │
        ▼
Reverses 16-byte token
        │
        ▼
Uses reversed token as RC4 key
        │
        ▼
Continuously monitors clipboard
        │
        ▼
Clipboard changes detected
        │
        ▼
Encrypt clipboard contents
        │
        ▼
POST encrypted data
        │
        ▼
203.49.53.184
```

---

# Final Answers

| Question               | Answer                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| Process responsible    | **Discord.exe**                                                                  |
| DLL load Unix Epoch    | **1782570491**                                                                   |
| Exported function      | **D3D11CreateDevice**                                                            |
| Mutex                  | **Local\DiscordRuntimeCache**                                                    |
| Registry value         | **1aa3a658ce2c4a4258983eba1853f08c**                                             |
| MITRE ATT&CK Technique | **T1115**                                                                        |
| C2 IP                  | **203.49.53.184**                                                                |
| Wallet seed phrase     | **glow fix connect talon title risk barrel marine truth disease garbage cheese** |

---

# Conclusion

Rather than relying on a single artifact, the complete attack chain only becomes visible after correlating information from registry hives, Procmon logs, network captures, and reverse engineering the malware itself.

The malware uses DLL proxying to execute inside Discord, creates a mutex to avoid duplicate execution, maintains a registry-backed session token for encryption, continuously monitors the clipboard, encrypts newly copied data using RC4, and finally exfiltrates the encrypted contents to its command-and-control server.
