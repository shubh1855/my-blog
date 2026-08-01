---
title: "The Hollow Courier"
description: "Writeup for The Hollow Courier from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-30
categories:
  - [Writeups, HTB Cyber Apocalypse CTF 2026: The Salt Crown]
tags:
  - HTB Cyber Apocalypse 2026
  - Secure Coding
  - Web
  - Flask
  - CTF
---

# The Hollow Courier

## Summary

This challenge was a proxy trust misconfiguration that exposed an internal-only route.

The vulnerable endpoint was `POST /app/gate/decree`. It was intended to be reachable only by the application's internal watch relay, but the Flask app trusted too many `X-Forwarded-For` hops. That allowed an external client to spoof an internal source address and bypass the internal-only check.

The fix was to reduce Flask's trusted proxy hop count from `x_for=2` to `x_for=1`, which matches the actual deployment topology in this repository.

## How We Found It

We approached the challenge by reading the route definitions and the tests together.

### 1. Identify security-sensitive routes

The first place to inspect was [checkpoint/app/routes.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/app/routes.py). That file documents the route surface clearly:

- `POST /app/gate/present`
- `GET /app/gate/inspect`
- `POST /app/gate/decree`

The important part was this comment and guard around `decree()`:

- "Inner desk: seal a binding crown decree for the watch."
- `if not gate.require_internal(): abort(403)`

That immediately marked `/app/gate/decree` as the most security-sensitive endpoint in the application, because it is not supposed to be public.

### 2. Inspect how "internal" is decided

Next we read [checkpoint/app/gate.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/app/gate.py).

The check is based on `request.remote_addr`, which is accepted as internal when it falls into one of these ranges:

- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `127.0.0.2/32`

By itself that is not necessarily wrong, but it means the correctness of the access control depends entirely on whether `request.remote_addr` is reconstructed safely behind proxies.

### 3. Inspect the proxy boundary

Then we read [checkpoint/conf/Caddyfile](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/conf/Caddyfile) and [checkpoint/app/**init**.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/app/__init__.py).

The Caddy config shows a single reverse proxy hop:

- Caddy listens on `:8000`
- It proxies to `127.0.0.1:5000`

The Flask app uses:

```python
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2, x_proto=1, x_host=1)
```

That was the key mismatch.

There is only one trusted proxy in this repository's deployment path, but the app was trusting two `X-Forwarded-For` entries. In Werkzeug `ProxyFix`, over-trusting proxy hops lets an attacker control which earlier address in the forwarding chain becomes `request.remote_addr`.

That means a client can send a forged `X-Forwarded-For` header containing an internal-looking address and trick the app into treating the request as internal.

## Root Cause

The root cause was incorrect trust of proxy-supplied client IP metadata.

The application assumed this topology:

- trusted proxy 1
- trusted proxy 2
- application

But the repository actually deploys:

- Caddy
- application

With `x_for=2`, the app trusted one hop too many. That makes the left side of the forwarded chain partially attacker-controlled.

In practical terms, an external request could present a header like:

```http
X-Forwarded-For: 127.0.0.2, 198.51.100.9
```

and, because the app trusted two forwarded addresses, `request.remote_addr` could resolve to the internal alias `127.0.0.2` instead of the real external client.

That breaks the guarantee around:

- `gate.require_internal()`
- internal-only access to `/app/gate/decree`

## How We Solved It

We changed the proxy trust configuration in [checkpoint/app/**init**.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/app/__init__.py#L21).

### Before

```python
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2, x_proto=1, x_host=1)
```

### After

```python
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
```

We also updated the comment above that line to document the reasoning:

- the service sits behind a single trusted proxy hop
- trusting more forwarded entries enables origin spoofing

This is the smallest correct fix because it preserves the intended use of proxy headers while aligning trust with the real deployment.

## How We Tested It

We used two levels of validation.

### 1. Add a regression test

We added a test in [checkpoint/tests/test_gate.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/tests/test_gate.py#L56):

```python
def test_decree_rejects_spoofed_forwarded_for_chain(client):
    response = client.post(
        "/app/gate/decree",
        json={"order": "bar the south rail"},
        environ_overrides={"REMOTE_ADDR": "127.0.0.1"},
        headers={"X-Forwarded-For": "127.0.0.2, 198.51.100.9"},
    )
    assert response.status_code == 403
```

This test models the actual issue:

- the app receives a request through the local proxy path
- the client supplies a forged forwarded chain
- the route must still reject the request as external

Before the fix, this kind of input could be interpreted as internal. After the fix, it is denied.

### 2. Run the full test suite

We created a local virtual environment, installed the challenge dependencies, and ran the checkpoint tests with:

```bash
cd checkpoint
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
```

Result:

```text
26 passed in 1.18s
```

This matters because the challenge explicitly requires preserving normal behavior. Running the full test suite verified that:

- public routes still work
- staff and role-gated pages still work
- writ verification still works
- the new security behavior does not break the rest of the checkpoint

## Why This Fix Is Correct

This fix is correct for both security and functionality.

### Security

- It prevents attacker-controlled `X-Forwarded-For` values from being over-trusted.
- It restores the integrity of `request.remote_addr`.
- It protects the internal-only route from external spoofing.

### Functionality

- The application still understands proxy headers from the one real perimeter proxy.
- No route logic changed except for the trust boundary interpretation.
- All existing tests still pass.

## Final Patch

Files changed:

- [checkpoint/app/**init**.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/app/__init__.py)
- [checkpoint/tests/test_gate.py](/home/shubh/Project/htb-cyber-apocalypse/secure-coding/core_application/checkpoint/tests/test_gate.py)

Commit used for submission:

- `bc4bbae` - `Fix internal route proxy trust`

## Short Version

We found the bug by tracing the internal-only route, then following how client origin was reconstructed behind the proxy. The app trusted two forwarded IP hops even though the repo's deployment only has one trusted proxy. That allowed external origin spoofing through `X-Forwarded-For` and exposed `/app/gate/decree`. We fixed it by changing `ProxyFix(..., x_for=2)` to `ProxyFix(..., x_for=1)`, added a regression test for spoofed forwarded chains, and verified the patch with the full test suite.
