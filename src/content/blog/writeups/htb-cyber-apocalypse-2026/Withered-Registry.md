---
title: "Withered Registry"
description: "Writeup for Withered Registry from Hack The Box Cyber Apocalypse CTF 2026: The Salt Crown."
date: 2026-07-30
categories:
  - [Writeups, "HTB Cyber Apocalypse CTF 2026: The Salt Crown"]
tags:
  - HTB Cyber Apocalypse 2026
  - Secure Coding
  - Web
  - IDOR
  - CTF
---

# Withered Registry

## Overview

This challenge was about identifying and fixing the security flaw in the Withered Registry backend without breaking the normal ledger and field-slate workflow.

After reviewing the codebase, the vulnerable path turned out to be the crown-writ workflow at `POST /rite/recognise`. That route changes a house's standing to `crown` and records a writ, so it is one of the highest-impact state-changing operations in the application.

The short version of the bug is:

- the route required a valid authenticated session
- the route also required a valid HMAC seal from the field device
- but the route still let the client choose which `house_id` would be acted on

That meant the server had a trusted identity available, but it did not use that identity as the source of truth for authorization scope.

## How I Found the Bug

I started from the README and followed the areas it pointed to:

- `internal/server/auth.go`
- `internal/server/authz.go`
- `internal/server/signing.go`
- `internal/server/routes.go`
- existing handler tests in `internal/server/server_test.go`

The important part of the architecture was visible pretty quickly:

- session cookies identify the logged-in scribe
- the `Principal` carries `ScribeID`, `Username`, and `HouseID`
- `ownsHouse(...)` and `houseOf(...)` already exist for house-scoped authorization
- slate requests are HMAC-sealed with `SLATE_KEY`

At that point, the obvious question was: does the privileged crown route use the authenticated principal as its scope, or does it trust request input?

The answer was in `handleRecognise`.

## What the Vulnerable Code Did

Before the final fix, the route accepted both authenticated session state and a valid slate seal, but it still derived the target house from request-controlled input:

```go
type recogniseRequest struct {
    HouseID string `json:"house_id"`
}

func targetHouse(r *http.Request, body *recogniseRequest) string {
    if h := strings.TrimSpace(r.URL.Query().Get("house_id")); h != "" {
        return h
    }
    return strings.TrimSpace(body.HouseID)
}

func (s *Server) handleRecognise(w http.ResponseWriter, r *http.Request) {
    if !s.requireSlate(w, r) {
        return
    }

    p, _ := principalFrom(r)

    var body recogniseRequest
    if r.Body != nil {
        _ = json.NewDecoder(r.Body).Decode(&body)
    }
    house := targetHouse(r, &body)

    writ, err := s.store.GrantCrownWrit(house, p.Username)
    ...
}
```

This is where the security flaw lived.

The session had already established who the scribe was and which house they served. But instead of using that verified `HouseID`, the route accepted a `house_id` from the query string or request body and passed it into `GrantCrownWrit(...)`.

So the server asked:

- "is this request from a valid device?"
- "is this request from a logged-in scribe?"

but it did **not** ask:

- "is the house being modified the authenticated scribe's own house?"

## Why This Was a Security Vulnerability

The field-device seal provided integrity and origin validation. It proved that the request was signed with the slate key and had not been modified after signing.

It did **not** provide business authorization.

That distinction matters:

- the seal proves the request is authentic to the device workflow
- the session proves which scribe is logged in
- only the session should define which house that scribe is allowed to act on

Because the route let request input choose the target house, any authenticated user able to make a valid sealed request could try to raise another house to `crown` standing.

That has real impact in this application because crown standing exposes the senior disclosure packet on the public house page.

So the practical consequence was:

1. log in as one house's scribe
2. submit a valid sealed `/rite/recognise` request
3. supply a different `house_id`
4. server crowns the wrong house
5. public crown packet becomes visible for that house

This is broken access control. It is also very close to an IDOR pattern, because a sensitive object identifier supplied by the client was trusted in a privileged operation.

## First Fix Attempt

My first patch added an ownership check after parsing the requested target:

```go
house := targetHouse(r, &body)
if !ownsHouse(p, house) {
    writeJSON(w, http.StatusForbidden, map[string]string{
        "error": "a scribe may only seal a writ for the house they serve",
    })
    return
}
```

I also added a regression test for the cross-house case.

That patch blocked the direct exploit, and from a narrow perspective it was better than the original code. But it was rejected, correctly, because it still used the wrong trust model.

The route was still:

1. reading scope from attacker-controlled input
2. comparing that scope to the principal

That is a guard around an unsafe design, not a clean authorization model.

## Why the First Fix Was Rejected

The feedback was accurate: the privileged path still derived its scope from user-controlled query/body input and only then compared it to the authenticated user.

That is brittle because it treats untrusted input as part of the authorization decision when the application already has a trusted source of scope in the session.

For secure design, the better rule is:

- if the authenticated principal already carries the correct authorization boundary, use that boundary directly
- do not let the client redefine it on privileged operations

In this application, the principal already includes `HouseID`. That should be the only house the rite acts on.

## Final Fix

The final fix removed request-driven target selection from the crown-writ workflow entirely.

Instead of reading `house_id` from the query string or body, the route now derives the acted-on house from the authenticated session:

```go
func (s *Server) handleRecognise(w http.ResponseWriter, r *http.Request) {
    if !s.requireSlate(w, r) {
        return
    }

    p, _ := principalFrom(r)
    house := houseOf(p)
    if house == "" {
        writeJSON(w, http.StatusUnauthorized, map[string]string{
            "error": "a scribe session is required",
        })
        return
    }

    writ, err := s.store.GrantCrownWrit(house, p.Username)
    ...
}
```

That changed the security model from:

- "client tells us which house to crown, then we try to validate it"

to:

- "session tells us which house this scribe serves, and that is the only house we will crown"

The slate seal is still required, but now it acts as an additional gate for the field-device workflow rather than being confused with authorization.

## Test Changes

I updated the tests to match the stronger authorization model.

The final regression coverage proves:

- normal sealed request still works for the authenticated scribe's house
- missing seal is still rejected
- missing session is still rejected
- hostile cross-house input no longer changes the target

The most important regression case is the last one:

- a logged-in `rookhold` scribe sends a sealed request to `/rite/recognise?house_id=ashvault`
- the server ignores the attacker-controlled target
- `ashvault` does **not** gain crown standing
- the action applies only to `rookhold`, the house from the verified session

That test demonstrates the final design rather than only checking for a `403`.

## Files Modified

- `registry-backend/internal/server/routes.go`
- `registry-backend/internal/server/server_test.go`

## Validation

After the final refactor, the test suite passed with:

```bash
env GOCACHE=/tmp/go-build-cache GOMODCACHE=/tmp/go-mod-cache go test ./...
```

Result:

```text
?   	git.witheredregistry.realm/registry/cmd/registry	[no test files]
?   	git.witheredregistry.realm/registry/internal/config	[no test files]
ok  	git.witheredregistry.realm/registry/internal/server	0.049s
?   	git.witheredregistry.realm/registry/internal/store	[no test files]
```

## Takeaway

The important lesson from this bug is that integrity and authorization are not the same thing.

The slate HMAC seal proved the request belonged to the device workflow, but it did not prove that the logged-in scribe had authority over whichever house identifier the client supplied.

The secure fix was to stop asking the client which house to act on and instead bind the privileged action to the house already established by the authenticated session.

That is the core of the vulnerability and the core of the repair.
