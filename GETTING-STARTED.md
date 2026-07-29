# Quick Start

Welcome to the astro-koharu blog theme! This document will help you get your blog up and running in 5 minutes.

## 1. Prerequisites

Ensure your computer has the following installed:

- **Node.js** 18.0 or higher
- **pnpm** package manager

If pnpm is not installed, run:

```bash
npm install -g pnpm
```

## 2. Start in Three Steps

### Step 1: Get the Code

```bash
# Method 1: Clone the repository
git clone https://github.com/cosZone/astro-koharu.git
cd astro-koharu

# Method 2: Use GitHub Template (Recommended)
# Click the "Use this template" button on the repository page
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Start the Development Server

```bash
pnpm dev
```

Open your browser and visit http://localhost:4321 to view your blog!

## 3. Configure Your Blog

### Basic Information

Edit `config/site.yaml`:

```yaml
site:
  title: Your Blog Title          # Site title
  alternate: myblog               # English short name, used for logo
  subtitle: Your Subtitle         # Subtitle
  name: Your Name                 # Author name
  description: Blog description   # One-sentence description
  author: Your Name               # Article author
  url: https://your-domain.com/   # Deployed domain
  defaultOgImage: /img/avatar.webp # Default Open Graph image
  startYear: 2024                 # Site creation year
  avatar: /img/avatar.webp        # Avatar path
  showLogo: true                  # Whether to show logo
  keywords:                       # SEO keywords
    - Blog
    - Tech
```

### Replace Avatar

Replace your avatar image at `public/img/avatar.webp`

### Social Links

Configure social media links in `config/site.yaml`:

```yaml
social:
  github:
    url: https://github.com/your-username
    icon: ri:github-fill
    color: '#191717'
  email:
    url: mailto:your@email.com
    icon: ri:mail-line
    color: '#55acd5'
  rss:
    url: /rss.xml
    icon: ri:rss-line
    color: '#ff6600'
  # Add more social links...
```

## 4. Write Your First Post

Create a Markdown file in the `src/content/blog/` directory.

### Basic Template

```markdown
---
title: My First Post
date: 2024-01-01 12:00:00
tags:
  - Tag1
  - Tag2
categories:
  - CategoryName
cover: /img/cover/1.webp
---

Article main content...
```

### Frontmatter Field Description

| Field | Required | Description |
| ------------- | ---- | ------------------------------- |
| `title` | ✅ | Article title |
| `date` | ✅ | Publishing date |
| `tags` | ❌ | List of tags |
| `categories` | ❌ | Categories, supports nesting like `[Notes, Frontend]` |
| `cover` | ❌ | Cover image path |
| `description` | ❌ | Article summary |
| `sticky` | ❌ | Set to `true` to pin article to top |
| `draft` | ❌ | Set to `true` to mark as draft |

### Using Categories

Single-level category:

```yaml
categories:
  - Essays
```

Nested categories:

```yaml
categories:
  - [Notes, Frontend]
```

## 5. Deployment

### One-Click Deployment with Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cosZone/astro-koharu&project-name=astro-koharu&repository-name=astro-koharu)

1. Click the button above
2. Log in with your GitHub account
3. Wait for the automatic deployment to complete

### Custom Domain

1. Add your domain in the Vercel project settings
2. Configure DNS as instructed
3. Update the `site.url` field in `config/site.yaml`

### Docker Deployment

If you prefer using Docker for deployment:

```bash
# 1. Copy the environment variable file and complete the configuration
cp .env.example .env

# 2. Build and start (run from repository root directory)
docker compose --env-file ./.env -f docker/docker-compose.yml up -d --build

# 3. Access your blog
open http://localhost:4321
```

**Important**: Asset generation scripts need to be run locally:

```bash
# After adding new images/posts, run locally first:
pnpm koharu generate all

# Then commit changes
git add src/assets/*.json
git commit -m "chore: update generated assets"

# Finally rebuild Docker
./docker/rebuild.sh
```

For detailed instructions, please refer to the [Docker Deployment section in the User Guide](./src/content/blog/tools/astro-koharu-guide.md).

## 6. Advanced Features

### Weekly / Series Articles

Configure `featuredSeries` in `config/site.yaml`:

```yaml
featuredSeries:
  categoryName: Weekly
  label: My Weekly
  fullName: My Tech Weekly
  description: Weekly tech sharing
  cover: /img/weekly_header.webp
  enabled: true
  links:
    github: https://github.com/your-username/your-repo
    rss: /rss.xml
```

Then create weekly articles in the `src/content/blog/` directory.

### Internationalization (i18n)

The blog has built-in multi-language support. Configure in `config/site.yaml`:

```yaml
i18n:
  defaultLocale: zh        # Default language (URL without prefix)
  locales:
    - code: zh
      label: 中文
    - code: en
      label: English
```

After configuration, the blog will automatically generate pages with language prefixes (e.g., `/en/post/xxx`), and a language switcher will appear in the navigation bar and mobile drawer.

**Adding Translated Articles**: Place translated articles under the `src/content/blog/<locale>/` directory, preserving the same path structure as the default language:

```plain
src/content/blog/
├── tools/getting-started.md        # Default language (zh)
└── en/tools/getting-started.md     # English translation
```

Articles without a corresponding translation will automatically fall back to displaying content in the default language with an indication prompt.

For more detailed configuration (content translation, adding new languages, etc.), please refer to the [i18n Configuration section in README](./README.md#多语言配置i18n).

### Background Music (BGM)

Configure the background music player in `config/site.yaml`:

```yaml
bgm:
  enabled: true
  # metingApi: https://163.hyc.moe/  # Custom Meting API address (default https://163.hyc.moe/)
  audio:
    - title: My Playlist
      list:
        - https://music.163.com/playlist?id=YOUR_PLAYLIST_ID
```

The audio player resolves music platform links via the [Meting](https://github.com/metowolf/meting) API. It uses a public API by default; **self-hosting is recommended for more stable service**.

### Content Generation (Optional)

Use Koharu CLI to generate content assets:

```bash
# Interactively select generation type
pnpm koharu generate

# Or specify the type directly
pnpm koharu generate lqips        # Generate LQIP image placeholders to enhance loading experience
pnpm koharu generate similarities # Generate semantic similarity vectors to recommend related articles
pnpm koharu generate summaries    # Generate AI summaries
pnpm koharu generate all          # Generate all
```

## Common Commands

| Command | Description |
| --------------------------- | ---------------------------------- |
| `pnpm dev` | Start development server |
| `pnpm build` | Build production version |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Code linting |
| `pnpm koharu` | Interactive CLI menu |
| `pnpm koharu backup` | Backup blog content (--full full backup) |
| `pnpm koharu restore` | Restore from backup (--latest restore latest) |
| `pnpm koharu update` | Update theme (--check, --clean, --rebase, etc.) |
| `pnpm koharu generate` | Generate content assets |
| `pnpm koharu clean` | Clean up old backups (--keep N keep N backups) |
| `pnpm koharu list` | View all backups |

## 7. Updating the Theme

When a new version of the theme is released, you can follow these steps to update while retaining your personal content.

### Update Using CLI (Recommended)

Use Koharu CLI to update the theme with one click, automatically completing the entire workflow: Backup → Fetch → Merge → Install Dependencies:

```bash
# Full update workflow (backups by default)
pnpm koharu update

# Check for updates only
pnpm koharu update --check

# Skip backup and update directly
pnpm koharu update --skip-backup

# Clean mode (zero conflicts, suitable for initial migration or when conflicts are numerous)
pnpm koharu update --clean

# Rebase mode (rewrite history, suitable for users familiar with git)
pnpm koharu update --rebase

# Preview operations (dry run without executing)
pnpm koharu update --dry-run

# Update to a specified version
pnpm koharu update --tag v2.1.0
```

**Three Update Modes:**

| Mode | Command | Suitable Scenario | Backup |
|------|------|---------|------|
| **Default** | `pnpm koharu update` | Daily updates | Optional |
| **Clean** | `pnpm koharu update --clean` | Initial migration, numerous conflicts | Mandatory |
| **Rebase** | `pnpm koharu update --rebase` | Users familiar with git | Mandatory |

- **Default Mode**: Uses `git merge` to merge upstream updates. Conflicts in user content (blog posts, configuration, etc.) will automatically keep the local version; only conflicts in theme files need to be resolved manually.
- **Clean Mode**: Replaces all theme files with the latest upstream version, then restores your user content from backup, achieving zero conflicts. **Note: Your custom modifications to theme files will not be preserved.**
- **Rebase Mode**: Replays your local commits on top of upstream, rewriting commit history. Suitable for users with a good understanding of git.

> **💡 For users familiar with git:** The CLI update command is a convenience wrapper around git operations. If you are familiar with git, you can directly use `git fetch upstream && git rebase upstream/main` (or `git merge`) manually to get more precise control over the merge process.

During the update process, it will automatically:
1. Check workspace status
2. Backup your personal content (optional, mandatory in clean/rebase mode)
3. Set upstream remote (if not set)
4. Fetch the latest code
5. Display new commit list and changelog
6. Merge updates (according to the selected mode)
7. Install dependencies

If merge conflicts occur, the CLI will display a list of conflicting files and provide resolution instructions. Conflicts in user content will be resolved automatically (retaining local versions).

### Manual Update

If you prefer manual operation:

```bash
# 1. Back up your personal content first
pnpm koharu backup --full

# 2. Add upstream repository (only needs to be executed once)
git remote add upstream https://github.com/cosZone/astro-koharu.git

# 3. Fetch latest code
git fetch upstream

# 4. Merge updates into your branch
git merge upstream/main

# 5. Resolve any conflicts, then install dependencies
pnpm install

# 6. Test if everything works
pnpm dev
```

### Restore Backup

If you need to restore from a backup after updating:

```bash
# View all backups
pnpm koharu list

# Preview files to be restored
pnpm koharu restore --dry-run

# Restore the latest backup
pnpm koharu restore --latest
```

### Post-Update Check

After completing the update, it is recommended to check the following:

1. **Configuration Compatibility**: If `config/site.yaml` has new fields, refer to `.env.example` or documentation to supplement them
2. **Dependency Update**: Run `pnpm install` to ensure dependencies are installed correctly
3. **Build Test**: Run `pnpm build` to ensure the build succeeds
4. **Functionality Test**: Run `pnpm dev` to check if pages render normally

### Notes

- If you modified the theme's source code (such as component styles), conflicts may occur during merge and must be resolved manually
- It is recommended to use `git stash` or create a branch to save local changes before updating
- For major version updates, please check [Release Notes](https://github.com/cosZone/astro-koharu/releases) for breaking changes

## Getting Help

- 📖 [Detailed User Guide](./src/content/blog/tools/astro-koharu-guide.md)
- 🐛 [Submit an Issue](https://github.com/cosZone/astro-koharu/issues)
- ⭐ [GitHub Repository](https://github.com/cosZone/astro-koharu)

---

Happy building!
