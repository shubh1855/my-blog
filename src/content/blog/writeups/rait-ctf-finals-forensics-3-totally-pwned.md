---
title: "RAIT-CTF Finals Forensics 3 - Totally Pwned"
description: "Writeup for RAIT-CTF Finals Forensics 3 - Totally Pwned from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - CTF
  - Writeups
tags:
  - RAIT-CTF
  - Forensics
---

# RAIT-CTF Finals Forensics 3 - Totally Pwned

Flag:  RAIT-CTF{Th3_Gh0st_1n_Th3_R3g1stry}

Approach (Step by Step):

1.  The challenge description says that the system had been compromised, so we check the places

that may have been affected by the malware.
2.  On checking the browser cache at the path:

C/Users/scary/AppData/Local/Microsoft/Edge/User Data/Default/Cache/Cache_Data/f_000083

3.  We found the data about it.


5.  Since the string is in leetspeak so we just arrange it according to the flag format. Hence we have

solved it.
