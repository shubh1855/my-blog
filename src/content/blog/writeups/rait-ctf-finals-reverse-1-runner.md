---
title: "RAIT-CTF Finals Reverse 1 - Runner"
description: "Writeup for RAIT-CTF Finals Reverse 1 - Runner from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups]
tags:
  - RAIT-CTF
  - Reverse Engineering
---

# RAIT-CTF Finals Reverse 1 - Runner

**Flag:** `RAIT-CTF{M4ze_Runn3r_Pr0_Ed1t10n_1337}`

## Approach (Step by Step)

### Step 1: Service Interaction

Connect to the challenge service using netcat:

```bash
nc 34.0.14.121 9952
```

The service runs a stripped 64-bit ELF binary that validates user input through a custom stack-based virtual machine.

### Step 2: VM & Maze Reverse Engineering

Static analysis of the binary reveals:
- A custom VM interpreter in the `.text` section.
- Embedded bytecode in `.data` initializing a maze.
- A 25x26 maze stored in a flat memory region starting at address `0x1000`.
- Movement controlled via single-character inputs (`R`, `L`, `U`, `D`).
- Invalid moves (wall/bounds) immediately halt execution.

### Step 3: Maze Reconstruction

The bytecode initializes wall cells using repeated `PUSH_IMM32` → `STORE_MAZE` instructions. By mapping flat memory indices with a stride of 26, the maze grid is reconstructed.

- **Start position:** (0, 0)
- **Goal position:** (22, 22)
- **Row 23:** Full wall boundary preventing bypass

### Step 4: Valid Move Sequence

The correct path through the maze is:

`R12 → D2 → L2 → D2 → L2 → U2 → L4 → D2 → R2 → D2 → L6 → D2 → R6 → D6 → R2 → D4 → R4 → D2 → L6 → U2 → L4 → U2 → L2 → D6 → R2 → U2 → R2 → D2 → R10 → U2 → R2 → D2 → R4 → U2 → R2 → D2`

Expanded as a single contiguous input string sent to the service:

```text
RRRRRRRRRRRRDDLLDDLLUULLLLDDRRDDLLLLLLDDRRRRRRDDDDDDRRDDDDRRRRDDLLLLLLUULLLLUULLDDDDDDRRUURRDDRRRRRRRRRRUURRDDRRRRUURRDD
```

Carriage returns and newlines are ignored by the VM.

### Step 5: Flag Retrieval

Upon reaching the goal cell, the VM executes its flag-read routine and prints the contents of `flag.txt`:

`RAIT-CTF{M4ze_Runn3r_Pr0_Ed1t10n_1337}`
