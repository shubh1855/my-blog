# Deployment Adapters

astro-koharu supports automatically detecting the deployment platform and selecting the corresponding adapter.

## Supported Platforms

| Platform | Adapter | Environment Variable Detection |
| --- | --- | --- |
| **Vercel** | `@astrojs/vercel` | `VERCEL=1` |
| **Netlify** | `@astrojs/netlify` | `NETLIFY=true` |
| **Self-hosted / Docker** | `@astrojs/node` | Other cases (fallback) |

## Deployment Guide

### Vercel

1. Connect GitHub repository to Vercel
2. Automatically detects and uses `@astrojs/vercel` adapter
3. One-click deployment: [Deploy with Vercel](https://vercel.com/new/clone?repository-url=https://github.com/cosZone/astro-koharu)

### Netlify

1. Connect GitHub repository to Netlify
2. Build command: `pnpm build`
3. Publish directory: `dist`
4. Automatically uses `@astrojs/netlify` adapter

### Self-Hosted (Node.js)

```bash
# Build
pnpm build

# Run
node dist/server/entry.mjs
```

### Docker Deployment

The project provides a complete Docker deployment solution: multi-stage build (`node:22-alpine` builds static files → `nginx:alpine` hosts service), resulting in a final image containing only nginx + static assets.

#### Prerequisites

- Docker Engine 20.10+
- Docker Compose V2 (`docker compose` command)

#### Quick Start

**1. Configure Environment Variables**

```bash
cp .env.example .env
```

Edit `.env` and fill in your configuration:

```bash
# Blog port (default 4321)
BLOG_PORT=4321
```

> Comment system and analytics configurations have been migrated to `config/site.yaml` and no longer require injection via environment variables.

**2. Build and Start**

```bash
# Use pnpm shortcut command
pnpm docker:up

# Or manually execute full command
docker compose --env-file ./.env -f docker/docker-compose.yml up -d --build
```

Access `http://localhost:4321` (or your configured `BLOG_PORT`).

**3. Daily Management**

```bash
pnpm docker:logs      # View real-time logs
pnpm docker:down      # Stop and remove containers
pnpm docker:rebuild   # Full rebuild (stop old container → rebuild → start)
```

#### Redeploying After Content Updates

When you modify blog content, `config/site.yaml`, or `.env`:

```bash
# Recommended to generate content assets first (LQIP, similarity, AI summaries)
pnpm koharu generate all

# Then rebuild and deploy
pnpm docker:rebuild
```

`rebuild.sh` will automatically check if `.env` exists and prompt whether to run content generation scripts.

#### Directory Structure

```plain
docker/
├── Dockerfile            # Multi-stage build (builder → nginx)
├── docker-compose.yml    # Service orchestration
├── nginx/
│   └── default.conf      # nginx configuration (gzip, caching, security headers, SPA routing)
└── rebuild.sh            # One-click rebuild script
```

#### nginx Configuration Notes

`docker/nginx/default.conf` includes the following optimizations:

- **Gzip Compression**: JS/CSS/SVG/JSON and other resources are automatically compressed
- **Long-term Static Resource Caching**: `js/css/images/fonts` set to 1-year cache + `immutable`
- **Short-term HTML Caching**: 1 hour + `must-revalidate`
- **Security Headers**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- **Astro Routing**: `try_files $uri $uri/index.html =404` matching static output format
- **Pagefind Search**: Independent caching policy (1 day)

#### Custom Reverse Proxy

If running behind a reverse proxy like nginx/Caddy, change port mapping to bind only to 127.0.0.1:

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:${BLOG_PORT:-4321}:80"
```

Then configure forwarding to this port in the outer reverse proxy.

#### Environment Variables

| Variable | Description | Default Value |
|------|------|--------|
| `BLOG_PORT` | Host port mapping | `4321` |

## Local Testing

Test specific platform adapters:

```bash
# Vercel
VERCEL=1 NODE_ENV=production pnpm build

# Netlify
NETLIFY=true NODE_ENV=production pnpm build

# Node.js (default)
NODE_ENV=production pnpm build
```

## Related Documentation

- [Astro On-demand Rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Vercel Adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/)
- [Netlify Adapter](https://docs.astro.build/en/guides/integrations-guide/netlify/)
- [Node Adapter](https://docs.astro.build/en/guides/integrations-guide/node/)
