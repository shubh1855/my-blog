# astro-koharu Project Overview

## Project Introduction

astro-koharu is a modern static blog system built on top of **Astro 5.x**, migrated from Hexo, and inspired by the Shoka theme. The project uses React for interactive components and Tailwind CSS for styling, while maintaining compatibility with the original Hexo blog content.

### Project Features

- **High Performance**: Astro Islands architecture, zero JavaScript by default, loaded on demand
- **Modern**: React 19 + Tailwind CSS 4 + Motion animation library
- **Content First**: Astro Content Collections managing 183+ blog posts
- **Full-Text Search**: Pagefind static search, no backend required
- **Theme Switching**: Dark/light modes supporting View Transitions animations
- **Hexo Compatibility**: Retains original post formats and category structures

---

## Tech Stack Overview

```plain
┌─────────────────────────────────────────────────────────────┐
│                        astro-koharu                         │
├─────────────────────────────────────────────────────────────┤
│  Framework Layer                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Astro 5.x  │  │  React 19   │  │  TypeScript │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Styling Layer                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Tailwind 4  │  │   Motion    │  │  CSS Vars   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Feature Layer                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Nanostores  │  │  Pagefind   │  │ Floating UI │         │
│  │ State Mgt.  │  │ Full Search │  │Float Position│        │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  Content Layer                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Content    │  │   Shiki     │  │   Rehype    │         │
│  │ Collections │  │Code Highltng│  │  Markdown   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Core Dependencies Overview

| Dependency | Version | Purpose |
| --- | --- | --- |
| `astro` | 5.2.3 | Core framework, static site generation |
| `react` | 19.0.0 | Interactive component development |
| `tailwindcss` | 4.0.0 | Atomic CSS framework |
| `motion` | 11.15.0 | Animation library (successor to Framer Motion) |
| `nanostores` | - | Lightweight state management |
| `astro-pagefind` | - | Static full-text search |
| `astro-icon` | 1.1.5 | Icon system (Iconify) |

---

## Directory Structure

```plain
astro-koharu/
├── public/                     # Static assets (copied directly to build directory)
│   ├── favicon.ico
│   ├── img/                    # Image assets
│   │   ├── avatar.webp        # Avatar
│   │   └── cover/             # Article covers
│   └── js/                     # Third-party scripts
│
├── src/                        # Source code
│   ├── assets/                 # Assets requiring processing
│   │   └── svg/               # SVG files
│   │
│   ├── components/             # Component library (60+ components)
│   │   ├── common/            # Common components (ErrorBoundary)
│   │   ├── layout/            # Layout components (Header, Navigator)
│   │   ├── ui/                # UI base components (Button, Card, Popover)
│   │   ├── post/              # Post-related components
│   │   ├── category/          # Category components
│   │   ├── theme/             # Theme switcher
│   │   ├── friends/           # Friend link components
│   │   └── comment/           # Comment components
│   │
│   ├── content/                # Astro Content Collections
│   │   ├── config.ts          # Schema definition
│   │   └── blog/              # Blog posts (183 articles)
│   │       ├── life/          # Essays / Life
│   │       ├── note/          # Notes
│   │       │   ├── front-end/ # Front-end notes
│   │       │   └── ...
│   │       ├── weekly/        # Weekly issues
│   │       └── ...
│   │
│   ├── constants/              # Constant configurations
│   │   ├── site-config.ts     # Site configuration (most important)
│   │   ├── router.ts          # Navigation routing
│   │   ├── design-tokens.ts   # Design tokens
│   │   └── anim/              # Animation configuration
│   │
│   ├── hooks/                  # React Hooks
│   │   ├── useToggle.ts
│   │   ├── useFloatingUI.ts
│   │   └── ...
│   │
│   ├── layouts/                # Page layouts
│   │   ├── Layout.astro       # Main layout
│   │   └── TwoColumnLayout.astro
│   │
│   ├── lib/                    # Utility functions
│   │   ├── content/           # Content operations
│   │   │   ├── posts.ts       # Post queries
│   │   │   ├── categories.ts  # Category processing
│   │   │   └── tags.ts        # Tag processing
│   │   ├── utils.ts           # General utilities
│   │   └── datetime.ts        # Date processing
│   │
│   ├── pages/                  # Page routes
│   │   ├── index.astro        # Home page
│   │   ├── post/[...slug].astro    # Post detail
│   │   ├── posts/[...page].astro   # Post list
│   │   ├── categories/        # Category pages
│   │   ├── tags/              # Tag pages
│   │   └── rss.xml.ts         # RSS feed
│   │
│   ├── store/                  # Nanostores state
│   │   ├── app.ts             # App state
│   │   └── ui.ts              # UI state
│   │
│   ├── styles/                 # Global styles
│   │   ├── index.css          # Entry point
│   │   ├── global/            # Global styles
│   │   ├── theme/             # Theme styles
│   │   └── components/        # Component styles
│   │
│   └── types/                  # TypeScript types
│       ├── blog.ts
│       └── components.ts
│
├── astro.config.mjs            # Astro configuration
├── tailwind.config.mjs         # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
├── _config.yml                 # Hexo category mapping (legacy)
└── CLAUDE.md                   # AI assistant guide
```

---

## Quick Start

### Environment Requirements

- **Node.js**: 18.x or higher
- **Package Manager**: pnpm 9.15.1 (specified by project)

### Installation & Execution

```bash
# 1. Clone the repository
git clone <repo-url>
cd astro-koharu

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev
# Visit http://localhost:4321

# 4. Build production version
pnpm build

# 5. Preview build result
pnpm preview
```

### Common Commands Reference

| Command | Description |
| --- | --- |
| `pnpm dev` | Start development server |
| `pnpm build` | Build production version |
| `pnpm preview` | Preview production build |
| `pnpm lint` | Run ESLint checks |
| `pnpm lint-md` | Check Markdown files |
| `pnpm lint-md:fix` | Automatically fix Markdown issues |
| `pnpm knip` | Find unused code and dependencies |
| `pnpm change` | Generate CHANGELOG |

---

## Path Aliases

The project configures rich path aliases to simplify import paths:

```typescript
// Defined in tsconfig.json
import { cn } from '@lib/utils';           // src/lib/utils.ts
import { Button } from '@components/ui/button';  // src/components/ui/button.tsx
import { siteConfig } from '@constants/site-config';  // src/constants/site-config.ts
import type { BlogPost } from '@types/blog';  // src/types/blog.ts
```

| Alias | Mapped Path |
| --- | --- |
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@lib/*` | `src/lib/*` |
| `@constants/*` | `src/constants/*` |
| `@hooks/*` | `src/hooks/*` |
| `@store/*` | `src/store/*` |
| `@types/*` | `src/types/*` |
| `@layouts/*` | `src/layouts/*` |
| `@pages/*` | `src/pages/*` |
| `@content/*` | `src/content/*` |
| `@styles/*` | `src/styles/*` |
| `@assets/*` | `src/assets/*` |
| `@scripts/*` | `src/scripts/*` |

---

## Site Configuration

The core site configuration is located at `src/constants/site-config.ts`:

```typescript
export const siteConfig = {
  // Basic info
  title: '余弦の博客',
  alternate: 'cosine',
  subtitle: 'WA 的一声就哭了',
  name: 'cos',
  description: 'FE / ACG / 手工 / 深色模式强迫症...',

  // Resources
  avatar: '/img/avatar.webp',
  site: 'https://blog.cosine.ren/',
  startYear: 2020,

  // Featured categories (displayed on home page)
  featuredCategories: [...],

  // Weekly column configuration
  featuredSeries: {
    categoryName: '周刊',
    label: 'FE Bits',
    fullName: 'FE Bits 前端周周谈',
  },

  // Social links
  socialConfig: {
    github: '...',
    bilibili: '...',
    email: '...',
    twitter: '...',
    rss: '/rss.xml',
  }
};
```

---

## Page Routing Overview

```plain
/                           # Home page (Latest posts + Sticky posts)
├── /posts/[page]           # Post list pagination
├── /post/[slug]            # Post detail page
├── /categories/            # Category index
│   └── /categories/[...slug]  # Category page (supports multi-level)
├── /tags/                  # Tag index
│   └── /tags/[tag]         # Tag page
├── /archives               # Archives page
├── /weekly                 # Weekly column
├── /friends                # Friends page
├── /about                  # About page
└── /rss.xml                # RSS feed
```

---

## Document Navigation

This document series consists of 10 articles, recommended to be read in order:

1. **[00-overview.md](./00-overview.md)** (Current) - Project overview and quick start
2. **[01-architecture.md](./01-architecture.md)** - Architecture design and tech stack
3. **[02-content-system.md](./02-content-system.md)** - Content system deep dive
4. **[03-routing.md](./03-routing.md)** - Routing system detailed guide
5. **[04-component-patterns.md](./04-component-patterns.md)** - Component patterns and best practices
6. **[05-ui-components.md](./05-ui-components.md)** - UI component library implementation
7. **[06-state-management.md](./06-state-management.md)** - State management (Nanostores)
8. **[07-theme-system.md](./07-theme-system.md)** - Theme system implementation
9. **[08-animation-system.md](./08-animation-system.md)** - Animation system design
10. **[09-styling.md](./09-styling.md)** - Styling system (Tailwind + Design Tokens)

---

## Key Takeaways

- astro-koharu is a modern blog project migrated from Hexo to Astro
- Uses Astro Islands architecture, static rendering by default, React components hydrated on demand
- Clear project structure, organized modularly by feature
- Uses pnpm as package manager to ensure consistent dependency versions
- Path aliases simplify module imports and enhance development experience
