---
title: "RAIT-CTF Finals Reverse 2 - Employee Manager"
description: "Writeup for RAIT-CTF Finals Reverse 2 - Employee Manager from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - CTF
  - Writeups
tags:
  - RAIT-CTF
  - Reverse Engineering
---

# RAIT-CTF Finals Reverse 2 - Employee Manager

Flag: RAIT-CTF{p4tches_g3ts_y0u_M4TCH3SSS}

Approach (Step by Step):

Binary Information

Property

File Name

Architecture

Language

Image Base

Entry Point

Value

employee_manager.exe

PE32+ (x64)

Go (with Fyne GUI framework)

0x140000000

0x1400013e0 (mainCRTStartup)

Challenge Architecture

The binary implements a tabbed GUI application with two distinct unlock mechanisms:
•  Tab 1: "Employee Manager" - Validates employee credentials with time-based

constraints

•  Tab 2: "Redeem Coupon" - Validates a coupon code with input length restrictions

Each tab, when successfully validated, decrypts a portion of the flag using XOR encryption with
a shared key. The flag is split into two parts stored as encrypted byte arrays in the binary's data
section.

Encryption Mechanism

XOR Key

Both flag components use the same encryption key:


Symbol

main.key

Address

0x140795a20

Value

0x55

RAIT-CTF Final Round Report

Decryption Algorithm

The decryption logic, found in both main.main.func1 and main.main.func3, implements a simple
XOR cipher:

for i := 0; i < len(encrypted_array); i++ {
    decrypted[i] = encrypted_array[i] ^ main.key
}

Assembly implementation at 0x14070a742 (func1) and 0x14070a235 (func3):
MOVZX ESI, byte ptr [RDX + RBX*0x1]  ; Load encrypted byte
MOVZX EDI, byte ptr [0x140795a20]   ; Load key (0x55)
XOR   ESI, EDI                       ; XOR decrypt
MOV   byte ptr [RAX + RBX*0x1], SIL  ; Store result

Tab 1: Employee Manager (Flag Part 1)

Validation Function

Function: main.main.func1 @ 0x14070a320

Credential Requirements

Field

Required Value

Validation

Employee Name

raitadmin

Employee ID

1337

Case-insensitive, trimmed,
lowercased to 'raitadmin'

Exact match (checked
as integer
0x37333331)

Time-Based Validation

The challenge implements a time-based check that requires execution during a specific time
window:

•  Hour Check: (seconds_since_epoch % 86400) / 3600 == 3
•  This requires execution during the 3 AM hour (03:00-03:59)
•  Minute Check: Complex calculation requiring ((seconds % 3600) /

magic_constant) >> 5 == 0x21

•  This effectively requires a specific minute within the hour

Encrypted Flag Storage

Component

Address

Value


0x140eda6e0

0x1407980d0

25 bytes

25 bytes

Slice Header

Array Pointer

Length

Capacity

Decryption Results

Type

Encrypted (hex)

RAIT-CTF Final Round Report

{array_ptr, len, cap}

(points to encrypted data)

Value

2534272178646f7507141c01781601132e25
6121363d30260a

Decrypted

part-1: RAIT-CTF{p4tches_

Tab 2: Redeem Coupon (Flag Part 2)

Validation Functions

Entry Validation: main.main.func2 @ 0x14070a2c0
Redemption Handler: main.main.func3 @ 0x14070a140

Input Length Contradiction

The challenge presents an intentional contradiction:
•  func2 limits input to maximum 5 characters
•  func3 requires exactly 8 characters for validation
•  This suggests the validation may need to be bypassed or the input restriction

circumvented

Coupon Code Validation

The redemption handler checks the input against a hardcoded 8-byte value stored in little-
endian format:

Check

Length

Value

8 bytes

Expected Value (hex)

0x21214d3333443352

Expected Value (LE bytes)

52 33 44 33 33 4d 21 21

Expected Value (ASCII)

R3D33M!!

Assembly implementation at 0x14070a166:

CMP qword ptr [RSI+0x78], 0x8      ; Check length == 8
JNZ fail
MOV RSI, qword ptr [RSI+0x70]      ; Get string data pointer


MOV R9, 0x21214d3333443352         ; Load expected value
CMP qword ptr [RSI], R9            ; Compare first 8 bytes

RAIT-CTF Final Round Report

Encrypted Flag Storage

Component

Slice Header

Array Pointer

Length

Capacity

Decryption Results

Type

Encrypted (hex)

Address

0x140eda700

0x140797530

19 bytes

19 bytes

Value

{array_ptr, len, cap}

(points to encrypted data)

Value

326621260a2c65200a186101161d66060606
28

Decrypted

g3ts_y0u_M4TCH3SSS}

Analysis Methodology

Tools Used

•  Ghidra - Static analysis and decompilation
•  Python - Binary parsing and data extraction
•  PE file format analysis - Virtual address to file offset mapping

Analysis Steps

Identified main GUI setup function (main.main @ 0x140709820)

•
•  Located and decompiled three callback functions (func1, func2, func3)
•  Analyzed validation logic and identified credential requirements
•  Located XOR decryption loops in both func1 and func3
•  Found main.key global variable through cross-references
•  Disassembled validation functions to identify slice header addresses
•  Extracted main.f1 and main.f2 slice headers from data section
•  Mapped virtual addresses to file offsets in PE binary
•  Read encrypted byte arrays from file
•  Decrypted both arrays using XOR with key 0x55
•  Combined decrypted parts to form complete flag


Key Addresses Reference

Functions

Function

main.main

Address

0x140709820

main.main.func1

0x14070a320

RAIT-CTF Final Round Report

Purpose

GUI setup and initialization

Employee Manager
validation (Part 1)

main.main.func2

0x14070a2c0

Coupon entry validation

main.main.func3

0x14070a140

Coupon redemption handler
(Part 2)

Global Variables

Symbol

Virtual Address

File Offset

main.key

0x140795a20

0x794a20

main.f1 (slice)

0x140eda6e0

0xed96e0

main.f2 (slice)

0x140eda700

0xed9700

Value

0x55

{ptr, len, cap}

{ptr, len, cap}

Encrypted Data Arrays

Array

Virtual Address

File Offset

main.f1.array

0x1407980d0

0x7970d0

main.f2.array

0x140797530

0x796530

Length

25 bytes

19 bytes

Final flag: RAIT-CTF{p4tches_g3ts_y0u_M4TCH3SSS}
