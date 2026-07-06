---
title: "RAIT-CTF Finals Forensics 1 - Move It"
description: "Writeup for RAIT-CTF Finals Forensics 1 - Move It from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - CTF
  - Writeups
tags:
  - RAIT-CTF
  - Forensics
---

# RAIT-CTF Finals Forensics 1 - Move It

Flag: RAIT-CTF{m0u53_m0v3m3n75_c4n_b3_tr1cky}

Approach (Step by Step):

1.  Download the capture.pcap file for the challenges

2.  Open the capture.pcap in wireshark

RAIT-CTF Final Round Report

3.  We find that the logs in wireshark show that it’s a usb device logs so we use tshark and extract the

data to .csv format
tshark -r capture.pcap -Y "usb.transfer_type == 0x01 && usb.endpoint_address.direction == 1" -T
fields -e usb.capdata > mouse_data.csv

4.  Open https://usb-mouse-pcap-visualizer.vercel.app



5.  Upload the mouse_data.csv and it will start the plotting

6.  After ploting we find a QR code and when we decode the qr code we find the flag RAIT-

CTF{m0u53_m0v3m3n75_c4n_b3_tr1cky}
