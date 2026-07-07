---
title: "RAIT-CTF Finals Reverse 2 - Employee Manager"
description: "Writeup for RAIT-CTF Finals Reverse 2 - Employee Manager from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups]
tags:
  - RAIT-CTF
  - Reverse Engineering
---

# RAIT-CTF Finals Reverse 2 - Employee Manager

**Flag:** `RAIT-CTF{p4tches_g3ts_y0u_M4TCH3SSS}`

## Approach (Step by Step)

### Binary Information

The target binary is a 64-bit Windows executable written in Go, featuring a GUI built with the Fyne framework.

| Property         | Value                          |
| ---------------- | ------------------------------ |
| **File Name**    | employee_manager.exe           |
| **Architecture** | PE32+ (x64)                    |
| **Language**     | Go (with Fyne GUI framework)   |
| **Image Base**   | `0x140000000`                  |
| **Entry Point**  | `0x1400013e0` (mainCRTStartup) |

### Challenge Architecture

The binary implements a tabbed GUI application with two distinct unlock mechanisms:

- **Tab 1: "Employee Manager"** - Validates employee credentials with time-based constraints.
- **Tab 2: "Redeem Coupon"** - Validates a coupon code with input length restrictions.

Each tab, when successfully validated, decrypts a portion of the flag using XOR encryption with a shared key. The flag is split into two parts stored as encrypted byte arrays in the binary's data section.

### Encryption Mechanism & XOR Key

Both flag components use the same encryption key for the XOR cipher.

| Symbol     | Address       | Value  |
| ---------- | ------------- | ------ |
| `main.key` | `0x140795a20` | `0x55` |

### Decryption Algorithm

The decryption logic, found in both `main.main.func1` and `main.main.func3`, implements a simple XOR cipher against the `main.key` (`0x55`).

```go
for i := 0; i < len(encrypted_array); i++ {
    decrypted[i] = encrypted_array[i] ^ main.key
}
```

This is the equivalent Assembly implementation at `0x14070a742` (`func1`) and `0x14070a235` (`func3`):

```asm
MOVZX ESI, byte ptr [RDX + RBX*0x1]  ; Load encrypted byte
MOVZX EDI, byte ptr [0x140795a20]    ; Load key (0x55)
XOR   ESI, EDI                       ; XOR decrypt
MOV   byte ptr [RAX + RBX*0x1], SIL  ; Store result
```

## Tab 1: Employee Manager (Flag Part 1)

This tab's validation logic is handled by `main.main.func1` at `0x14070a320`.

### Credential Requirements

| Field             | Required Value | Validation                                    |
| ----------------- | -------------- | --------------------------------------------- |
| **Employee Name** | `raitadmin`    | Case-insensitive, trimmed, lowercased         |
| **Employee ID**   | `1337`         | Exact match (checked as integer `0x37333331`) |

### Time-Based Validation

The challenge implements a time-based check that requires execution during a specific time window:

- **Hour Check**: `(seconds_since_epoch % 86400) / 3600 == 3`
  - This requires execution during the 3 AM hour (03:00-03:59).
- **Minute Check**: Complex calculation requiring `((seconds % 3600) / magic_constant) >> 5 == 0x21`
  - This effectively requires a specific minute within the hour.

### Encrypted Flag Storage & Decryption

The encrypted flag part 1 is stored as a Go slice header pointing to a byte array.

| Component         | Address       | Value                      |
| ----------------- | ------------- | -------------------------- |
| **Slice Header**  | `0x140eda6e0` | `{array_ptr, len, cap}`    |
| **Array Pointer** | `0x1407980d0` | (points to encrypted data) |
| **Length**        | -             | 25 bytes                   |
| **Capacity**      | -             | 25 bytes                   |

- **Encrypted (hex)**: `2534272178646f7507141c01781601132e256121363d30260a`
- **Decrypted**: `part-1: RAIT-CTF{p4tches_`

## Tab 2: Redeem Coupon (Flag Part 2)

This tab's logic involves two functions:

- **Entry Validation**: `main.main.func2` at `0x14070a2c0`
- **Redemption Handler**: `main.main.func3` at `0x14070a140`

### Input Length Contradiction

The challenge presents an intentional contradiction:

- `func2` limits input to a maximum of 5 characters.
- `func3` requires exactly 8 characters for validation.
- _This suggests the validation may need to be bypassed or the input restriction circumvented in memory._

### Coupon Code Validation

The redemption handler checks the input against a hardcoded 8-byte value stored in little-endian format.

| Check                         | Value                     |
| ----------------------------- | ------------------------- |
| **Length**                    | 8 bytes                   |
| **Expected Value (hex)**      | `0x21214d3333443352`      |
| **Expected Value (LE bytes)** | `52 33 44 33 33 4d 21 21` |
| **Expected Value (ASCII)**    | `R3D33M!!`                |

Assembly implementation at `0x14070a166`:

```asm
CMP qword ptr [RSI+0x78], 0x8      ; Check length == 8
JNZ fail
MOV RSI, qword ptr [RSI+0x70]      ; Get string data pointer

MOV R9, 0x21214d3333443352         ; Load expected value
CMP qword ptr [RSI], R9            ; Compare first 8 bytes
```

### Encrypted Flag Storage & Decryption

The encrypted flag part 2 is also stored via a Go slice.

| Component         | Address       | Value                      |
| ----------------- | ------------- | -------------------------- |
| **Slice Header**  | `0x140eda700` | `{array_ptr, len, cap}`    |
| **Array Pointer** | `0x140797530` | (points to encrypted data) |
| **Length**        | -             | 19 bytes                   |
| **Capacity**      | -             | 19 bytes                   |

- **Encrypted (hex)**: `326621260a2c65200a186101161d6606060628`
- **Decrypted**: `g3ts_y0u_M4TCH3SSS}`

Combining both decrypted parts gives the final flag:
`RAIT-CTF{p4tches_g3ts_y0u_M4TCH3SSS}`

## Analysis Methodology

### Tools Used

- **Ghidra** - Static analysis and decompilation
- **Python** - Binary parsing and data extraction
- **PE file format analysis** - Virtual address to file offset mapping

### Analysis Steps

1. Identified main GUI setup function (`main.main` @ `0x140709820`).
2. Located and decompiled three callback functions (`func1`, `func2`, `func3`).
3. Analyzed validation logic and identified credential requirements.
4. Located XOR decryption loops in both `func1` and `func3`.
5. Found `main.key` global variable through cross-references.
6. Disassembled validation functions to identify slice header addresses.
7. Extracted `main.f1` and `main.f2` slice headers from data section.
8. Mapped virtual addresses to file offsets in PE binary.
9. Read encrypted byte arrays from file.
10. Decrypted both arrays using XOR with key `0x55`.
11. Combined decrypted parts to form complete flag.

## Key Addresses Reference

### Functions

| Function          | Address       | Purpose                              |
| ----------------- | ------------- | ------------------------------------ |
| `main.main`       | `0x140709820` | GUI setup and initialization         |
| `main.main.func1` | `0x14070a320` | Employee Manager validation (Part 1) |
| `main.main.func2` | `0x14070a2c0` | Coupon entry validation              |
| `main.main.func3` | `0x14070a140` | Coupon redemption handler (Part 2)   |

### Global Variables

| Symbol            | Virtual Address | File Offset | Value             |
| ----------------- | --------------- | ----------- | ----------------- |
| `main.key`        | `0x140795a20`   | `0x794a20`  | `0x55`            |
| `main.f1` (slice) | `0x140eda6e0`   | `0xed96e0`  | `{ptr, len, cap}` |
| `main.f2` (slice) | `0x140eda700`   | `0xed9700`  | `{ptr, len, cap}` |

### Encrypted Data Arrays

| Array           | Virtual Address | File Offset | Length   |
| --------------- | --------------- | ----------- | -------- |
| `main.f1.array` | `0x1407980d0`   | `0x7970d0`  | 25 bytes |
| `main.f2.array` | `0x140797530`   | `0x796530`  | 19 bytes |
