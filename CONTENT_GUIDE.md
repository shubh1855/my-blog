# Content Guide — How to Add Posts

This guide explains how to create and manage blog posts on your astro-koharu site.

---

## Directory Structure

All blog posts live inside:

```plain
src/content/blog/
```

Posts are organized into **category folders**. The folder name becomes the category.

```plain
src/content/blog/
├── writeups/          # Cybersecurity writeups
│   ├── htb-box-1.md
│   └── thm-room-1.md
├── development/       # Development posts
│   └── my-setup.md
├── security/          # Security research
│   └── malware-analysis.md
└── general/           # General posts
    └── hello-world.md
```

> **Tip**: You can nest folders for sub-categories:
> `src/content/blog/writeups/hackthebox/machine-name.md`

---

## Post Frontmatter (Required Fields)

Every `.md` file needs a YAML frontmatter block at the top. Here's the **minimum** required:

```markdown
---
title: "My Post Title"
date: 2025-07-05
categories:
  - Writeups
---

Your content here...
```

### All Available Frontmatter Fields

```yaml
---
# REQUIRED
title: "Post Title"                    # The post title
date: 2025-07-05 14:30:00              # Publication date (YYYY-MM-DD or with time)

# RECOMMENDED
description: "A brief summary"         # Shows in post cards and SEO meta
categories:                            # Post category (matches folder name)
  - Writeups
tags:                                  # Tags for filtering
  - CTF
  - HackTheBox
  - Web
cover: "/img/cover/1.webp"             # Cover image path (from public/ folder)

# OPTIONAL
updated: 2025-07-06                    # Last updated date
link: custom-slug                      # Custom URL slug (default: filename)
sticky: true                           # Pin post to top of list
draft: true                            # Hide from production (visible in dev)
catalog: true                          # Show table of contents (default: true)
tocNumbering: true                     # Number the TOC headings (default: true)
math: true                             # Enable LaTeX math rendering
password: "secret"                     # Password-protect the post
keywords:                              # SEO keywords
  - cybersecurity
  - pentesting
---
```

---

## Example: CTF Writeup Post

Create a file at `src/content/blog/writeups/htb-headless.md`:

```markdown
---
title: "HackTheBox - Headless"
description: "Writeup for HTB Headless — XSS to RCE via cookie stealing and command injection"
date: 2025-07-05
categories:
  - Writeups
tags:
  - HackTheBox
  - XSS
  - RCE
  - Web
cover: "/img/cover/1.webp"
---

## Reconnaissance

Started with an nmap scan...

## Exploitation

Found an XSS vulnerability in the contact form...

## Privilege Escalation

After getting a shell as user...

## Flags

- **User**: `abc123...`
- **Root**: `def456...`
```

---

## Example: Development Post

Create a file at `src/content/blog/development/neovim-setup.md`:

```markdown
---
title: "My Neovim Setup for Security Research"
description: "How I configured Neovim for CTFs and security work"
date: 2025-07-05
categories:
  - Development
tags:
  - Neovim
  - Tools
  - Setup
---

## Plugins I Use

Here's my plugin list...
```

---

## Cover Images

Place cover images in the `public/img/cover/` directory:

```plain
public/
└── img/
    └── cover/
        ├── 1.webp
        ├── 2.webp
        └── my-custom-cover.webp
```

Then reference them in frontmatter as:
```yaml
cover: "/img/cover/my-custom-cover.webp"
```

---

## Markdown Features

Your posts support standard Markdown plus extras:

- **Code blocks** with syntax highlighting (specify language after ```)
- **LaTeX math** (enable with `math: true` in frontmatter)
  - Inline: `$E=mc^2$`
  - Block: `$$\sum_{i=1}^n i$$`
- **Tables**, **blockquotes**, **images**
- **Task lists**: `- [x] Done`
- **Footnotes**: `Text[^1]` ... `[^1]: Footnote content`

---

## Music Page

The music page is at `src/pages/music.md`. It currently uses the Meting API which only supports **NetEase Cloud Music** and **QQ Music** links. Edit the playlists in `config/site.yaml` under the `bgm:` section.

---

## Quick Start Checklist

1. Create a folder under `src/content/blog/` for your category (e.g., `writeups/`)
2. Create a `.md` file inside it
3. Add the frontmatter with at least `title`, `date`, and `categories`
4. Write your content in Markdown below the frontmatter
5. Run `pnpm dev` to preview locally
6. Commit and push to deploy!
