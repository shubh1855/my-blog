---
link: 'writeups/kpmg-ctf-2026/vision'
title: "Vision - KPMG CTF 2026"
description: "Writeup for Vision from KPMG CTF 2026. Repairing a corrupted JPEG disguised with a fake PNG header, adjusting SOF dimensions, and decoding Morse code encoded in word lengths."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Crypto
  - Steganography
  - Morse Code
  - File Forensics
---

# KPMG CTF 2026 - Vision

---

## Challenge Description

> A damaged visual asset named `challenge_file.png` was retrieved from a remote communications relay. The file fails to render in standard image viewers. Repair the asset and uncover the message hidden in plain sight.

---

## Step 1 - Analyzing the Corrupted File

Running `file` and inspecting the initial bytes with `xxd`:

```bash
file challenge_file.png
xxd -g 1 -l 48 challenge_file.png
```

```text
00000000: 89 50 4e 47 0d 0a 1a 0a 49 46 00 01 01 00 00 01  .PNG....IF......
00000010: 00 01 00 00 ff db 00 43 00 08 06 06 07 06 05 08  ......C.........
```

The file opens with the 8-byte PNG signature `89 50 4E 47 0D 0A 1A 0A`, but fails to follow with a valid `IHDR` chunk. Instead, at offset 20 (`0x14`), the bytes immediately transition into `FF DB`, which is a JPEG Define Quantization Table (DQT) marker.

The PNG header was a decoy prepended to raw JPEG stream data.

---

## Step 2 - Extracting and Repairing the JPEG Header

To restore the image, we stripped the leading 20 decoy bytes and prepended the standard JPEG Start of Image (SOI) marker (`FF D8`).

However, rendering the recovered JPEG only showed half of the image text; the lower section was cut off. Inspecting the baseline Start of Frame (`SOF0`, `FF C0`) marker explained why:

```bash
identify -verbose /tmp/recovered.jpg | grep -i geometry
```

The header defined dimensions of `800 x 550`. The actual pixel stream was approximately 1000 pixels tall. Patching the height field in `FF C0` from `550` (`0x0226`) to `1000` (`0x03E8`) revealed the full image.

![Patching the image height bytes in hex](/img/posts/kpmg-ctf-2026-96_crypto_vision_hex_edit.webp)

Here is a Python script that strips the decoy prefix and corrects the height marker:

```python
from pathlib import Path

source = Path("challenge_file.png")
data = source.read_bytes()

# Strip 20-byte decoy prefix and prepend JPEG SOI (FF D8)
jpeg = bytearray(b"\xff\xd8" + data[20:])

# Locate baseline Start of Frame marker (FF C0)
sof = jpeg.find(b"\xff\xc0")
if sof < 0:
    raise SystemExit("Could not find JPEG SOF0 marker")

height = int.from_bytes(jpeg[sof + 5:sof + 7], "big")
width = int.from_bytes(jpeg[sof + 7:sof + 9], "big")
print(f"Original dimensions in header: {width} x {height}")

# Patch height from 550 to 1000
jpeg[sof + 5:sof + 7] = (1000).to_bytes(2, "big")

output = Path("vision_recovered.jpg")
output.write_bytes(jpeg)
print("Saved repaired image to vision_recovered.jpg")
```

The repaired image rendered completely:

![Fully recovered image containing paragraph](/img/posts/kpmg-ctf-2026-97_crypto_vision_recovered.webp)

---

## Step 3 - Transcribing the Paragraph

Reading the text from the repaired image:

> Hackers sneak through, and steal network secrets daily. Now foreign systems are falling offline today. Our agent seeks answers without delay tonight. The mystery grows thicker after all hunters for every ghost machine trace can uncover these signals beneath radar. You watch their codes, but virus worms creep forward forever. And worse logic bombs corrupt records. All shadows exist outside the walls where digital thieves dwell quietly. The alert watcher can analyze bytes, yet nothing makes sense. His chief focus remains finding those hackers. Who wrote these complex files? New teams writing strange scripts nightly. Our nearest enemy has dropped decoy nodes. Now every cyber soldier marches ahead bravely. Men extract botnets, and purge dirty files forever tonight. The victory takes massive efforts under attacks.

---

## Step 4 - Decoding Morse Code from Word Lengths

Analyzing the length of every word in the text revealed a consistent pattern: each word has a length of exactly 3, 5, or 7 letters:

| Word Length | Role | Morse Symbol |
|---|---|---|
| 3 letters | Character delimiter | `|` |
| 5 letters | Dot | `.` |
| 7 letters | Dash | `-` |

Looking at the opening sequence:
- `Hackers` (7 letters) -> `-`
- `sneak` (5 letters) -> `.`
- `through` (7 letters) -> `-`
- `and` (3 letters) -> delimiter (`|`)

The sequence `-.-` corresponds to the letter **K**.

Next word group:
- `steal` (5) -> `.`
- `network` (7) -> `-`
- `secrets` (7) -> `-`
- `daily` (5) -> `.`
- `Now` (3) -> delimiter

The sequence `.--.` corresponds to the letter **P**.

Continuing this translation across the paragraph produces:

```text
K P M G _ C T F ( S 3 3 K _ A N D _ F 1 N D _ M 3 (
```

The character `-.--.` in standard Morse represents an open parenthesis `(`. The challenge authors used parentheses as substitutes for `{` and `}` brackets.

Converting `(` into `{` and `}` yields the final flag.

---

## Step 5 - Automated Python Solver

```python
import re

text = """Hackers sneak through and steal network secrets daily. Now foreign systems are falling offline today. Our agent seeks answers without delay tonight. The mystery grows thicker after all hunters for every ghost machine trace can uncover these signals beneath radar. You watch their codes but virus worms creep forward forever. And worse logic bombs corrupt records. All shadows exist outside the walls where digital thieves dwell quietly. The alert watcher can analyze bytes yet nothing makes sense. His chief focus remains finding those hackers. Who wrote these complex files? New teams writing strange scripts nightly. Our nearest enemy has dropped decoy nodes. Now every cyber soldier marches ahead bravely. Men extract botnets and purge dirty files forever tonight. The victory takes massive efforts under attacks."""

words = re.findall(r"[A-Za-z]+", text)
length_to_morse = {3: "|", 5: ".", 7: "-"}

stream = "".join(length_to_morse[len(w)] for w in words)

morse_dict = {
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
    "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
    "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
    ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
    "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
    "--..": "Z", ".----": "1", "...--": "3", "..--.-": "_",
    "-.--.": "(",
}

decoded = "".join(morse_dict[code] for code in stream.split("|") if code)

# Replace delimiters to match flag format
flag = decoded.replace("(", "{", 1)[:-1] + "}"
print("Recovered Flag:", flag)
```

Running the script outputs:

```text
Recovered Flag: KPMG_CTF{S33K_AND_F1ND_M3}
```

---

## Flag

```plain
KPMG_CTF{S33K_AND_F1ND_M3}
```

---

## Summary

The challenge combined low-level image repair with classical steganography. We stripped a fake PNG decoy header, patched the truncated JPEG height bytes in the `SOF0` marker to restore the full image, and mapped the 3, 5, and 7-character word lengths to Morse delimiters, dots, and dashes to extract the flag.
