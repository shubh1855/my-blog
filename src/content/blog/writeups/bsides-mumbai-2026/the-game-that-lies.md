---
link: "writeups/bsides-mumbai-2026/the-game-that-lies"
title: "The Game That Lies - BSides Mumbai CTF 2026"
description: "Writeup for The Game That Lies from BSides Mumbai CTF 2026."
date: 2026-10-01 14:47:00
categories:
  - [Writeups, BSides Mumbai CTF]
tags:
  - BSides Mumbai CTF
  - Reverse Engineering
  - Game Boy
  - PyBoy
  - Emulator
---

# BSides Mumbai CTF 2026 — The Game That Lies

## Challenge Description

> The game logic seems to work fine, but the emulator screen is buggy and unreliable. See if you can cut through the lies and find the treasure hidden inside.

**File:** `the_game_that_lies.gb` (Game Boy ROM, 32KB)

The core mechanic of this challenge relies on Game Boy architecture (specifically VRAM tilemaps and WRAM buffers). The game attempts to trick static analysis tools, forcing us to combine static reversing with dynamic emulation using `PyBoy` (a Game Boy emulator written in Python).

---

## Step 1 — Reconnaissance & Static Analysis

First, we analyzed the ROM file using standard tools like `file` and `strings`.

```bash
file the_game_that_lies.gb
# Output: Game Boy ROM image (Rev.01) [ROM ONLY], ROM: 256Kbit
```

![File Command Output](/img/posts/bsides-mumbai-2026-01_file_command.webp)

Dumping the printable strings revealed standard game text, but also a suspicious sequence:

```text
SECURITY SYSTEM
PRESS START
ENTER 8-STEP CODE
WRONG INPUT = RESET
DIAG MODE
DIAG CODE: 4471-B
RECOVERY:
SYSTEM READY
```

![Strings Output](/img/posts/bsides-mumbai-2026-02_strings_output.webp)

Right next to the string `SYSTEM READY` at offset `0x2A0` in the ROM, we found a raw byte sequence:
`01 03 04 02 05 06 FF 00`

By disassembling the joypad reading routine at `0x5F7` (which checks bits in the Game Boy's `0xFF00` hardware register), we mapped these bytes to button presses:

- `01` = UP (Bit 2)
- `02` = DOWN (Bit 3)
- `03` = LEFT (Bit 1)
- `04` = RIGHT (Bit 0)
- `05` = A (Bit 4)
- `06` = B (Bit 5)

This gave us a 6-step code: **UP, LEFT, RIGHT, DOWN, A, B**.

---

## Step 2 — Falling for the Trap (Dynamic Emulation)

To test this code, we wrote a Python script using the `PyBoy` library. This allowed us to emulate the Game Boy headlessly, programmatically press the buttons, and read the Video RAM (VRAM) to see what the screen was trying to display without relying on buggy graphics rendering.

**Why we did this:** The challenge stated the screen is "buggy and unreliable". In Game Boy architecture, text is typically rendered via a tilemap (indices mapping to font graphics). Even if the graphics are corrupted (XOR'd or blanked out), the _tilemap indices_ usually still match standard ASCII.

### PyBoy Script (The Lie)

```python
from pyboy import PyBoy

pyboy = PyBoy('the_game_that_lies.gb', window='null')
pyboy.set_emulation_speed(0)

# Advance past boot screen and press START
for _ in range(300): pyboy.tick(render=False)
pyboy.button('start', delay=5)
for _ in range(120): pyboy.tick(render=False)

# Enter the static sequence found in ROM
for btn in ['up', 'left', 'right', 'down', 'a', 'b']:
    pyboy.button(btn, delay=10)
    for _ in range(60): pyboy.tick(render=False)

# Wait for output and dump VRAM (0x8000 - 0x9FFF)
for _ in range(300): pyboy.tick(render=False)
vram = bytes([pyboy.memory[0x8000 + i] for i in range(0x2000)])

# Read the tilemap area (0x9800)
tilemap = vram[0x1800:0x1C00]
print(bytes(tilemap).decode('latin-1', errors='ignore'))
pyboy.stop()
```

**The Output:**
`https://youtu.be/dQw4w9WgXcQ`

We got **Rickrolled**. The string explicitly asked for an **8-STEP CODE**, but our sequence was only 6 steps. The sequence at `0x2A0` was a deliberate lie placed to trick static analysts.

---

## Step 3 — Bypassing the PRNG (The Truth)

To find the real 8-step code, we disassembled the ROM using `mgbdis` and traced the input buffering logic.
We discovered:

1. User input is buffered into Work RAM (WRAM) starting at address `0xC0B3`.
2. A function at `0x696` runs heavily _on boot_ before the user even presses a button.
3. This function acts as a PRNG (Pseudo-Random Number Generator), seeded by the value at `0xC0B2` (which initializes to `0xF0`). It loops 8 times, generating 8 valid button presses, and pre-fills the input buffer at `0xC0B3` with the correct sequence.

**How we solved it:** Instead of manually reverse-engineering the PRNG math, we can just let the emulator boot up and dump the `0xC0B3` buffer _before_ we press any buttons. This extracts the generated truth dynamically.

### PyBoy Script (Extracting the Truth)

```python
from pyboy import PyBoy

pyboy = PyBoy('the_game_that_lies.gb', window='null')
pyboy.set_emulation_speed(0)

# Let the boot PRNG run
for _ in range(300): pyboy.tick(render=False)

# Dump the generated 8-byte sequence from WRAM
wram = bytes([pyboy.memory[0xC000 + i] for i in range(0x2000)])
seq = wram[0xB3:0xBB]
print("Real Code Bytes:", seq.hex())

mapping = {1: "up", 2: "down", 3: "left", 4: "right", 5: "a", 6: "b"}
print("Real Code Sequence:", [mapping[v] for v in seq])
pyboy.stop()
```

**The Output:**

```text
Real Code Bytes: 0605020203020401
Real Code Sequence: ['b', 'a', 'down', 'down', 'left', 'down', 'right', 'up']
```

---

## Step 4 — Extracting the Treasure

Armed with the true 8-step sequence, we modified our original PyBoy script to input this new code and parse the VRAM tilemap for the flag.

### PyBoy Script (Final Exploit)

```python
from pyboy import PyBoy

pyboy = PyBoy('the_game_that_lies.gb', window='null')
pyboy.set_emulation_speed(0)

# Advance past boot and press START
for _ in range(300): pyboy.tick(render=False)
pyboy.button('start', delay=5)
for _ in range(120): pyboy.tick(render=False)

# Enter the REAL 8-step sequence
sequence = ['b', 'a', 'down', 'down', 'left', 'down', 'right', 'up']
for btn in sequence:
    pyboy.button(btn, delay=10)
    for _ in range(60): pyboy.tick(render=False)

# Wait for decryption and dump VRAM
for _ in range(600): pyboy.tick(render=False)
vram = bytes([pyboy.memory[0x8000 + i] for i in range(0x2000)])
tilemap = vram[0x1800:0x1C00]

# Parse printable ASCII from the tilemap
flag_str = ""
for row in range(18):
    line = tilemap[row*32:(row+1)*32]
    out = ''
    for t in line[:20]:
        if 0x20 < t <= 0x7E:  # Standard ASCII bounds
            out += chr(t)
    if out:
        flag_str += out

print("Extracted String:", flag_str)
pyboy.stop()
```

**Final Output:**

```text
Extracted String: SYSTEMREADYBsides_Mumbai{st4t3_l1e5_wh3n_y0u_re4d_1t}
```

![Flag Output](/img/posts/bsides-mumbai-2026-03_flag_output.webp)

---

## Flag

```plain
Bsides_Mumbai{st4t3_l1e5_wh3n_y0u_re4d_1t}
```

---

## Summary

This challenge was a fantastic exercise in dynamic analysis. By combining static reverse engineering to find the input mechanisms and dynamic Python scripting with `PyBoy` to bypass the obfuscated screen and read raw RAM, we successfully extracted the flag and avoided the Rick Roll trap!
