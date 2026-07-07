---
title: "RAIT-CTF Finals Forensics 1 - Move It"
description: "Writeup for RAIT-CTF Finals Forensics 1 - Move It from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups]
tags:
  - RAIT-CTF
  - Forensics
---

# RAIT-CTF Finals Forensics 1 - Move It

**Flag:** `RAIT-CTF{m0u53_m0v3m3n75_c4n_b3_tr1cky}`

## Approach (Step by Step)

### 1. File Inspection

We download the `capture.pcap` file for the challenge and open it in Wireshark.

### 2. Traffic Analysis

We find that the logs in Wireshark show USB device logs, specifically mouse movements. We can use `tshark` to extract this raw capture data into a CSV format.

```bash
tshark -r capture.pcap -Y "usb.transfer_type == 0x01 && usb.endpoint_address.direction == 1" -T fields -e usb.capdata > mouse_data.csv
```

### 3. Mouse Trajectory Visualization

Open the [USB Mouse PCAP Visualizer](https://usb-mouse-pcap-visualizer.vercel.app). 
Upload the `mouse_data.csv` and it will start the plotting process mapping the USB mouse movements on an X/Y axis.

### 4. Retrieving the Flag

After plotting completes, the drawn lines form a QR code. When we scan and decode the QR code, we get the final flag:

`RAIT-CTF{m0u53_m0v3m3n75_c4n_b3_tr1cky}`
