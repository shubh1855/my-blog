---
link: 'writeups/htb-cyber-apocalypse-2026/the_compressed_truth'
title: "The Compressed Truth"
description: "Detailed writeup for The Compressed Truth from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-27
categories:
  - [Writeups, "HTB Cyber Apocalypse CTF 2026: The Salt Crown"]
tags:
  - HTB Cyber Apocalypse 2026
  - DFIR
  - Windows Registry
  - Registry Forensics
  - Windows
  - CTF
---

# Registry Forensics Writeup – Tracing a 7-Zip Exfiltration and KeeFarce Attack

## Challenge Overview

The challenge provides only a handful of Windows Registry hives extracted from an imaged machine. According to the scenario, an attacker named **CROWQUILL** logged into the machine using stolen credentials, accessed sensitive Registry records, extracted secrets from an unlocked KeePass database using a specialized tool, staged the stolen data, archived it using 7-Zip, and finally exfiltrated the archive.

The original files and tools had been deleted before the machine was seized, leaving only registry artifacts behind.

The goal was to reconstruct the entire attack chain and answer seven forensic questions solely from the registry.

> [!NOTE]
> I wasn't using windows using Procmon would have made it much easier

---

# Files Provided

After extracting the archive, the directory structure looked like this:

```text
C/
├── Users
│   ├── cyberjunkie
│   │   ├── NTUSER.DAT
│   │   ├── ntuser.dat.LOG1
│   │   └── ntuser.dat.LOG2
│   ├── Default
│   │   ├── NTUSER.DAT
│   │   ├── NTUSER.DAT.LOG1
│   │   └── NTUSER.DAT.LOG2
│   └── vmarr
│       ├── NTUSER.DAT
│       └── ntuser.dat.LOG1
└── Windows
    └── System32
        └── config
            ├── DEFAULT
            ├── DEFAULT.LOG1
            └── DEFAULT.LOG2
```

Since the challenge narrative explicitly states that the attacker authenticated as **vmarr**, the primary artifact of interest was:

```text
Users/vmarr/NTUSER.DAT
```

---

# Understanding the Challenge

Reading the description carefully immediately reveals several important clues.

- The attacker logged in as **vmarr**.
- A tool was brought onto the machine to extract secrets from an unlocked KeePass database.
- Files were compressed using **7-Zip**.
- Although the archive was removed, the registry still remembers the folders opened and the archive that was created.

This strongly suggested that the answers would be hidden inside the **7-Zip registry keys** stored within `NTUSER.DAT`.

---

# Enumerating the 7-Zip Registry Keys

The first step was to inspect the 7-Zip registry entries.

```python
from Registry import Registry

reg = Registry.Registry("vmarr/NTUSER.DAT")

key = reg.open(r"Software\7-Zip\FM")

for value in key.values():
    print(value.name(), value.value())
```

Initially, most values appeared as raw UTF-16 encoded bytes.

To decode them properly:

```python
from Registry import Registry

reg = Registry.Registry("vmarr/NTUSER.DAT")
key = reg.open(r"Software\7-Zip\FM")

for name in ["FolderHistory", "CopyHistory"]:
    print(f"\n{name}")

    data = key.value(name).value()
    text = data.decode("utf-16le", errors="ignore")

    for item in text.split("\x00"):
        if item.strip():
            print(item)
```

This produced readable paths.

---

# Question 1 — What tool extracted the secrets from memory?

The challenge description mentions:

> "A tool was brought for one purpose: extract secrets from memory before they could be put away."

Initially, I inspected **UserAssist** entries to determine recently executed programs.

```python
from Registry import Registry

reg = Registry.Registry("vmarr/NTUSER.DAT")

base = reg.open(
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist"
)

for guid in base.subkeys():
    print(guid.name())

    count = guid.subkey("Count")

    for value in count.values():
        print(value.name())
```

The entries were ROT13 encoded.

After decoding them, several executables appeared including:

- KeePass
- 7-Zip
- KAPE

However, the challenge wording specifically described a tool capable of extracting secrets from an **already unlocked KeePass process**, not simply stealing passwords.

That behavior matches **KeeFarce**, a well-known tool designed to dump unlocked KeePass databases directly from memory.

**Answer**

```text
KeeFarce
```

---

# Question 2 — When was the tool extracted?

The challenge specifically asks:

> "When was the tool extracted?"

Instead of execution timestamps, this pointed toward 7-Zip extraction history.

Inspecting every 7-Zip key:

```python
from Registry import Registry

reg = Registry.Registry("vmarr/NTUSER.DAT")
root = reg.open(r"Software\7-Zip")

def walk(key):
    print(key.path())
    print(key.timestamp())

    for subkey in key.subkeys():
        walk(subkey)

walk(root)
```

One registry key immediately stood out.

```text
Software\7-Zip\Extraction

LastWrite:
2026-06-18 13:15:15
```

Since the Extraction key is updated whenever files are extracted through 7-Zip, this timestamp corresponds to the extraction of the KeeFarce archive.

**Answer**

```text
2026-06-18 13:15:15
```

---

# Question 3 — What was the deepest folder enumerated inside the archive?

Decoding the `FolderHistory` value revealed:

```text
C:\Users\vmarr\Documents\Registry\
C:\Users\vmarr\Documents\Registry\oath_records_cinderbound_vol2.zip\
C:\Users\vmarr\Documents\Registry\oath_records_cinderbound_vol2.zip\oath_records_cinderbound_vol2\
C:\Users\vmarr\Documents\Registry\oath_records_cinderbound_vol2.zip\oath_records_cinderbound_vol2\saltoaths_secretive\
```

The deepest directory visited inside the archive was therefore:

```text
saltoaths_secretive
```

**Answer**

```text
saltoaths_secretive
```

---

# Question 4 — Where were the stolen records staged?

The registry contained another useful value:

```text
CopyHistory
```

Decoding it produced:

```text
C:\Users\vmarr\Desktop\working\
```

This represents the working directory where files were gathered before compression.

**Answer**

```text
C:\Users\vmarr\Desktop\working\
```

---

# Question 5 — What archive was prepared for exfiltration?

The `PathHistory` value inside the Extraction key revealed:

```python
from Registry import Registry

reg = Registry.Registry("vmarr/NTUSER.DAT")

key = reg.open(r"Software\7-Zip\Extraction")

data = key.value("PathHistory").value()

print(data.decode("utf-16le", errors="ignore").replace("\x00", "\n"))
```

Output:

```text
C:\Users\vmarr\AppData\Local\Temp\writ\KeeFarce\

C:\Users\Public\Pictures\shardchain.tar
```

The archive prepared for exfiltration was:

```text
C:\Users\Public\Pictures\shardchain.tar
```

**Answer**

```text
C:\Users\Public\Pictures\shardchain.tar
```

---

# Question 6 — Where was the master store kept?

While examining the decoded FolderHistory, one directory immediately matched the story.

```text
C:\Users\vmarr\Documents\Registry\shard_storage\ShardKeePass_FirstMark\
```

The challenge describes it as:

> "the master store of secrets"

The presence of "KeePass" in the folder name strongly reinforces that this is the protected password vault referenced in the narrative.

**Answer**

```text
C:\Users\vmarr\Documents\Registry\shard_storage\ShardKeePass_FirstMark\
```

---

# Question 7 — Where did CROWQUILL conclude operations while using 7-Zip?

At first glance, this question was slightly misleading.

The last entry in `FolderHistory` was simply:

```text
Computer
```

which turned out to be incorrect.

The important clue came from inspecting the current panel location.

The registry value:

```text
PanelPath0
```

contained:

```text
C:\Users\vmarr\Desktop\working\
```

Unlike FolderHistory, `PanelPath0` records the location that was open when 7-Zip was last closed.

Therefore, the final directory where the attacker concluded operations inside 7-Zip was:

```text
C:\Users\vmarr\Desktop\working\
```

**Answer**

```text
C:\Users\vmarr\Desktop\working\
```

---

# Final Answers

| Question                          | Answer                                                                     |
| --------------------------------- | -------------------------------------------------------------------------- |
| Tool used                         | **KeeFarce**                                                               |
| Extraction time                   | **2026-06-18 13:15:15**                                                    |
| Deepest folder inside archive     | **saltoaths_secretive**                                                    |
| Staging directory                 | **C:\Users\vmarr\Desktop\working**                                         |
| Archive prepared for exfiltration | **C:\Users\Public\Pictures\shardchain.tar**                                |
| Master store location             | **C:\Users\vmarr\Documents\Registry\shard_storage\ShardKeePass_FirstMark** |
| Final 7-Zip working directory     | **C:\Users\vmarr\Desktop\working**                                         |

---

# Conclusion

This challenge is an excellent demonstration of how much user activity survives inside the Windows Registry, even after files and tools have been deleted.

By examining a single `NTUSER.DAT` hive, it was possible to reconstruct the attacker's workflow:

1. Authenticate as `vmarr`.
2. Extract the KeeFarce tool using 7-Zip.
3. Dump secrets from an unlocked KeePass database.
4. Browse sensitive Registry records.
5. Stage the collected files.
6. Compress them into a tar archive.
7. Leave behind only registry artifacts documenting every significant step.

Despite the attacker removing the original files, Windows faithfully preserved a detailed history of folders visited, archives opened, extraction paths, and working directories—allowing the entire exfiltration process to be reconstructed from registry evidence alone.
