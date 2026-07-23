---
title: "Temporal Evidence - Xploitathon CTF"
description: "Writeup for Temporal Evidence from Xploitathon."
date: 2026-03-06 14:00:00
cover: "/img/cover/writeups-mobile.webp"
categories:
  - [Writeups, Xploitathon CTF]
tags:
  - Xploitathon
  - OSINT
---

# Temporal Evidence

**Category:** OSINT  
**Difficulty:** Medium

## Challenge Description

Temporal Evidence was an OSINT and digital forensics challenge where each artifact revealed the next clue. The solution required following a trail through publicly available information, image metadata, and a Linux filesystem image before piecing together the final flag.

## Approach

### Finding the First Lead

The provided video contained the string:

```text
WHITER0SE-123
```

Searching for this username led to a GitHub profile with a repository named **temporal-engine**. One of the commit messages suggested looking beyond the visible contents of the files, hinting that metadata would play an important role.

### Inspecting the Image

The second artifact was `final.png`. Running ExifTool revealed a large `UserComment` field containing an encoded payload.

```bash
exiftool final.png
```

After cleaning and decoding the Base64 data, it produced a ZIP archive containing:

```text
fsociety_evidence.img
```

Using the `file` utility confirmed it was an EXT4 filesystem image, which could be mounted for further analysis.

```bash
file fsociety_evidence.img
sudo mount -o loop fsociety_evidence.img /mnt/evidence
```

### Filesystem Analysis

Browsing the mounted filesystem eventually led to Elliot's home directory. The `.bash_history` file contained several previously executed commands, including a reference to the username:

![Shell  history](/img/posts/temporal-evidence.webp)

```text
_roboclipz
```

This became the next OSINT pivot.

### Final OSINT Pivot

Searching for `_roboclipz` uncovered a profile containing multiple cryptic posts. Individually they appeared meaningless, but together they formed the missing phrase required for the challenge.

Combining the recovered text with the flag format revealed the final answer.

```text
XPL8{3ll10t_F0und_Th3_H1dd3n_4rch1vE}
```

## Conclusion

Temporal Evidence was a great example of how multiple investigative techniques can complement each other. Instead of relying on a single trick, the challenge combined metadata analysis, filesystem forensics, shell history inspection, and OSINT to gradually reveal the solution. Each artifact contributed a small piece of the puzzle, rewarding a methodical approach over brute force.
