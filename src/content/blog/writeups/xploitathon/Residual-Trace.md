---
title: "Residual Trace - Xploitathon CTF"
description: "Writeup for Residual Trace from Xploitathon."
date: 2026-03-06 16:15:00
cover: "/img/cover/writeups-mobile.webp"
categories:
  - [Writeups, Xploitathon CTF]
tags: [Xploitathon, OSINT]
---

# Residual Trace

**Category:** OSINT

## Challenge Overview

Residual Trace required locating a historical Linux kernel panic log related to the Mr. Robot ARG and extracting a specific value from it.

## Approach

Researching the ARG led to archived resources, including the `kernel_panic.log` preserved in community repositories. Searching the log for the `NOHZ:` entry revealed:

Located the tykoth/MrRobotARG GitHub repository, which archives ARG content
including a kernel_panic.log file.

Found the kernel_panic.log mirrored on Pastebin (pastebin.com/2JNfLPwa),
posted September 7, 2016, containing the full kernel log

```text
NOHZ: local_softirq_pending 40
```

Using the required flag format produced:

```text
XPL8{local_softirq_pending_40}
```

## Conclusion

This challenge rewarded effective OSINT and archival research rather than technical exploitation.
