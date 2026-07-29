# Architecture Design and Tech Stack

## Astro Islands Architecture Concept

astro-koharu adopts Astro's **Islands Architecture**, which is core to understanding the entire project.

### What is Islands Architecture?

Traditional SPAs (Single Page Applications) treat the entire page as one JavaScript application, leading to:

- Loading a large amount of JS on first load
- Static content also requiring JS rendering
- Unfriendly to SEO

The concept of Islands Architecture is: **the page is static HTML by default, and JavaScript is loaded only for interactive parts ("islands")**.

```plain
┌─────────────────────────────────────────────────────────────┐
│                    Static HTML Page (Ocean)                 │
│  ┌─────────────┐                      ┌─────────────┐       │
│  │   React     │                      │   React     │       │
│  │ Component   │                      │ Component   │       │
│  │   Island    │                      │   Island    │       │
│  │ (Interactive)                      │ (Interactive)       │
│  └─────────────┘                      └─────────────┘       │
│                                                             │
│       Static Content (No JS)   Static Content (No JS)       │
│                                                             │
│  ┌─────────────┐                                            │
│  │   Astro     │         Pure HTML + CSS                    │
│  │ Component   │         No JavaScript required             │
│  │  (Static)   │                                            │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### Demonstration in astro-koharu

```typescript
// Static Astro Component - does not produce any JS
// src/components/post/PostList.astro
---
const posts = await getSortedPosts();
---
<ul>
  {posts.map(post => <PostItemCard post={post} />)}
</ul>

// Interactive React Component - loads JS only when needed
// src/pages/index.astro
<ThemeToggle client:load />        // Hydrated on page load
<SearchDialog client:visible />    // Hydrated when scrolled into view
<MenuIcon client:idle />           // Hydrated when browser is idle
```

---

## Tech Stack Selection Analysis

### Why Choose Astro?

| Requirement | Astro's Advantage |
| --- | --- |
| Blog Static Generation | Generates pure HTML by default, perfectly suited for CDNs |
| SEO Friendly | Server-side rendering, crawlers can read content directly |
| Content Management | Native support for Content Collections |
| Performance First | Zero JS by default, on-demand loading |
| Framework Flexibility | Mix and match React, Vue, Svelte |

### Why Choose React?

Interactive components in the project use React 19, for the following reasons:

1. **Mature Ecosystem**: Rich UI libraries (Radix UI, Floating UI)
2. **Powerful Hooks**: Complex state logic is easy to manage
3. **TypeScript Support**: Excellent type inference
4. **Motion Library**: Animation library natively supports React

### Why Choose Tailwind CSS 4?

1. **Atomic CSS**: Rapid development without naming classes
2. **On-demand Generation**: Bundles only used styles
3. **Design System**: Unified design tokens through configuration
4. **Dark Mode**: Native support via `dark:` prefix

### Why Choose Nanostores?

Nanostores was chosen for state management instead of Redux/Zustand:

1. **Extremely Lightweight**: < 1KB
2. **Framework Agnostic**: Usable by both Astro and React
3. **Simple API**: `atom` + `useStore` is all you need
4. **No Boilerplate**: No wrapping Provider required

---

## Configuration File Details

### astro.config.mjs

This is Astro's core configuration file:

```javascript
// astro.config.mjs
import react from '@astrojs/react';
import { siteConfig } from './src/constants/site-config';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import svgr from 'vite-plugin-svgr';
import umami from '@yeskunall/astro-umami';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import pagefind from 'astro-pagefind';

export default defineConfig({
  // 1. Site URL (used for generating absolute paths)
  site: siteConfig.site, // 'https://blog.cosine.ren/'

  // 2. Markdown processing configuration
  markdown: {
    gfm: true, // GitHub Flavored Markdown
    rehypePlugins: [
      rehypeSlug, // Generate IDs for headings
      [
        rehypeAutolinkHeadings, // Add anchor links to headings
        {
          behavior: 'append', // Append link after heading
          properties: {
            className: ['anchor-link'],
          },
        },
      ],
    ],
    shikiConfig: {
      themes: {
        light: 'github-light', // Light code theme
        dark: 'github-dark', // Dark code theme
      },
    },
  },

  // 3. Astro integrations
  integrations: [
    react(), // React support
    icon({
      // Icon system
      include: {
        gg: ['*'], // gg icon set
        'fa6-regular': ['*'],
        'fa6-solid': ['*'],
        ri: ['*'], // Remix Icon
      },
    }),
    umami({
      // Analytics
      id: '14de13b0-3220-4beb-8f0b-e08b17724991',
      endpointUrl: 'https://stats.cosine.ren',
      hostUrl: 'https://stats.cosine.ren',
    }),
    pagefind(), // Static search
  ],

  // 4. Dev toolbar
  devToolbar: {
    enabled: true,
  },

  // 5. Vite configuration (underlying build tool)
  vite: {
    plugins: [
      svgr(), // Convert SVG to React components
      tailwindcss(), // Tailwind CSS
    ],
  },

  // 6. Trailing slash handling for URLs
  trailingSlash: 'ignore', // Both /about and /about/ are valid
});
```

### Key Configuration Explanations

#### Markdown Processing Flow

```plain
Markdown File
     ↓
Parsed into AST (Syntax Tree)
     ↓
rehypeSlug → Generate id="heading" for ## Headings
     ↓
rehypeAutolinkHeadings → Add <a href="#heading">🔗</a>
     ↓
Shiki → Code block syntax highlighting
     ↓
Output HTML
```

#### Icon System Configuration

`astro-icon` integrates the Iconify icon library, with 4 icon sets configured:

```jsx
// Usage
import { Icon } from 'astro-icon/components';

<Icon name="ri:github-fill" />        // Remix Icon
<Icon name="fa6-solid:house" />       // Font Awesome 6 Solid
<Icon name="fa6-regular:heart" />     // Font Awesome 6 Regular
<Icon name="gg:menu" />               // css.gg Icon
```

### tsconfig.json

TypeScript configuration file:

```json
{
  "extends": "astro/tsconfigs/strict", // Inherit Astro strict config
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx", // React 17+ JSX transform
    "jsxImportSource": "react", // Automatically import React
    "baseUrl": "src", // Base path
    "paths": {
      // Path aliases
      "@/*": ["*"],
      "@components/*": ["components/*"],
      "@lib/*": ["lib/*"]
      // ... other aliases
    }
  }
}
```

#### How Path Aliases Work

```typescript
// Without alias
import { cn } from '../../../lib/utils';

// With alias (recommended)
import { cn } from '@lib/utils';
```

At compile time, TypeScript resolves `@lib/utils` to `src/lib/utils`.

---

## Main Layout Architecture

### Layout.astro Analysis

The main layout file `src/layouts/Layout.astro` is the foundation for all pages:

```astro
---
// 1. Type definitions
interface Props {
  title: string;
  description?: string;
  siderType?: HomeSiderType;
  post?: BlogPost;
}

// 2. Component imports
import FloatingGroup from '@components/layout/FloatingGroup.astro';
import Header from '@components/layout/Header.astro';
import MobileDrawer from '@components/layout/MobileDrawer.astro';
import { ClientRouter } from 'astro:transitions';
import '@styles/index.css'; // Global styles
---

<!doctype html>
<html transition:name="root" lang="zh-CN">
  <head>
    <!-- 3. SEO Metadata -->
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />

    <!-- 4. View Transitions -->
    <ClientRouter />

    <!-- 5. Theme initialization (prevents flash of wrong theme) -->
    <script is:inline>
      if (
        localStorage.theme === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ) {
        document.documentElement.classList.add('dark');
      }
    </script>
  </head>

  <body>
    <div class="flex min-h-screen flex-col">
      <!-- 6. Page structure -->
      <Header />
      <main class="relative flex grow flex-col gap-4">
        <slot />
        <!-- Page content insertion point -->
      </main>
      <FloatingGroup />
      <MobileDrawer type={siderType} post={post} />
    </div>
  </body>
</html>
```

### Architecture Flowchart

```plain
┌─────────────────────────────────────────────────────────────┐
│                         Layout.astro                        │
├─────────────────────────────────────────────────────────────┤
│  <head>                                                      │
│  ├── SEO Metadata (title, description, og:*)                 │
│  ├── ClientRouter (Page transition animations)              │
│  ├── LoadingIndicator                                       │
│  └── Theme initialization script (inline, runs immediately) │
├─────────────────────────────────────────────────────────────┤
│  <body>                                                      │
│  │                                                           │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │                    Header                           │ │
│  │  │  ┌─────────┐ ┌───────────────────┐ ┌─────────────┐ │ │
│  │  │  │  Logo   │ │    Navigator      │ │ ThemeToggle │ │ │
│  │  │  └─────────┘ └───────────────────┘ └─────────────┘ │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  ┌─────────────────────────────────────────────────────┐ │
│  │  │                    <main>                           │ │
│  │  │                                                     │ │
│  │  │                    <slot />                         │ │
│  │  │             (Page-specific content)                 │ │
│  │  │                                                     │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                           │
│  │  ┌──────────────┐           ┌───────────────────────┐    │
│  │  │ FloatingGroup│           │     MobileDrawer      │    │
│  │  │  - Back to top│           │    (Mobile Sidebar)   │    │
│  │  │  - Search btn│           │                       │    │
│  │  └──────────────┘           └───────────────────────┘    │
│  │                                                           │
│  └───────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────┘
```

---

## Build Flow

### Development Mode (pnpm dev)

```plain
Source file changes
    ↓
Vite HMR (Hot Module Replacement)
    ↓
Browser auto-refresh
```

### Production Build (pnpm build)

```plain
src/ Source files
    ↓
Astro Compilation
├── .astro components → Static HTML
├── .tsx components → JavaScript bundles (on demand)
├── .md files → HTML (Content Collections)
└── .css files → Optimized CSS
    ↓
Vite Bundling & Optimization
├── Code splitting
├── Tree shaking
└── Asset minification
    ↓
Pagefind Index Generation (Full-text search)
    ↓
dist/ Output directory
├── index.html
├── _astro/
│   ├── *.js (chunks)
│   └── *.css
├── post/
│   └── [slug]/index.html
└── pagefind/
    └── Search index files
```

---

## Client Directives Detailed

Astro provides various `client:*` directives to control when components load JavaScript:

### Directive Comparison

| Directive | When JS Loads | Use Case |
| --- | --- | --- |
| `client:load` | Immediately on page load | Critical interactions (Theme toggle, navigation) |
| `client:idle` | When browser is idle | Non-critical features (Comments, analytics) |
| `client:visible` | When component becomes visible | Lazy loading (Charts, footer components) |
| `client:media` | When media query matches | Responsive features |
| `client:only` | Client-side rendering only | Depends on browser APIs |

### Example Usage in Project

```astro
// src/layouts/Layout.astro // Theme toggle - critical feature, load immediately
<ThemeToggle client:load />

// src/components/layout/Header.astro // Dropdown nav - requires interaction
<DropdownNav client:load router={router} />

// src/pages/index.astro // Search dialog - load when visible
<SearchDialog client:visible />

// Menu icon - load when idle
<MenuIcon client:idle />
```

---

## View Transitions

Astro features built-in View Transitions API support to achieve page transition animations:

### Configuration Method

```astro
// Layout.astro
import { ClientRouter } from 'astro:transitions';

<html transition:name="root">
  <head>
    <ClientRouter />
  </head>
</html>
```

### How It Works

```plain
User clicks link
     ↓
Astro intercepts navigation
     ↓
Preloads target page
     ↓
View Transitions API
├── Old page fades out
└── New page fades in
     ↓
Updates URL (No full reload)
```

### Theme Switcher Compatibility

Since page transitions do not trigger a full refresh, theme needs to be checked after each navigation:

```javascript
// Layout.astro
document.addEventListener('astro:page-load', () => {
  // Check theme on every page load (including after transitions)
  if (localStorage.theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
});
```

---

## Key Takeaways

1. **Islands Architecture Core**: Pages are static by default, interactive components load JavaScript on demand
2. **Astro vs React Division of Labor**:
   - Astro components: Static content, layout, SEO
   - React components: Interaction, animation, complex state
3. **Configuration Hierarchy**:
   - `astro.config.mjs`: Framework-level configuration
   - `tsconfig.json`: TypeScript and path aliases
   - `tailwind.config.mjs`: Styling system
4. **Client Directives**: `client:load/idle/visible` control when JS is loaded
5. **View Transitions**: Seamless page transitions without refresh, improving user experience

---

## Related Files

| File | Description |
| --- | --- |
| `astro.config.mjs` | Astro core configuration |
| `tsconfig.json` | TypeScript configuration |
| `src/layouts/Layout.astro` | Main layout template |
| `src/constants/site-config.ts` | Site configuration |
| `package.json` | Dependencies and scripts |
