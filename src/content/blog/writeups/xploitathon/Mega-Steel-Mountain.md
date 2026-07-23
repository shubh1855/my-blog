---
title: "Mega Steel Mountain - Xploitathon CTF"
description: "Writeup for Mega Steel Mountain from Xploitathon."
date: 2026-03-06 15:30:00
cover: "/img/cover/writeups-mobile.webp"
categories:
  - [Writeups, Xploitathon CTF]
tags:
  - Xploitathon
  - Web
---

# Mega Steel Mountain

**Category:** Web  
**Difficulty:** Medium

## Challenge Overview

Mega Steel Mountain chained together multiple web vulnerabilities to obtain the flag. Starting from a shell exposed through a container, the challenge progressed through SQL injection, privilege escalation to the admin panel, and finally command injection.

## Approach

### Initial Access

The service exposed an interactive shell through `socat`.

```bash
nc 13.48.248.30 9999
```

This provided a root shell inside a Docker container. Enumeration revealed that the target web application was running locally on port `5000`.

### SQL Injection

While exploring the application, the `/tickets` endpoint accepted a `q` parameter that was directly incorporated into a database query.

Testing with a basic authentication bypass payload confirmed the endpoint was vulnerable:

```text
/tickets?q=' OR 1=1--
```

The injection exposed privileged data and allowed access to an administrator session for the user **elliot**.

### Command Injection

The administrator interface included a diagnostic feature that executed the system `ping` command. Because user input was not sanitized, arbitrary shell commands could be appended.

For example:

```text
host=127.0.0.1; cat /opt/deploy/run.sh
```

Once command execution was confirmed, additional sensitive files could be inspected.

### Recovering the Flag

Useful information was discovered in:

- `/opt/deploy/run.sh`
- `/opt/vault/root.key`

The final piece of the puzzle was hidden inside the Flask application's documentation string, which contained the complete flag.

```text
XPL8 {y0u_h4v3_h4ck3d_st33l_m0unt41n_3ll10t}
```

## Conclusion

Mega Steel Mountain showcased a realistic attack chain where several individually simple vulnerabilities combined into a full compromise. Careful enumeration followed by SQL injection, privilege escalation, and command injection ultimately led to the flag.
