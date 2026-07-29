# Markdown Parsing and Styling System

This document details the Markdown parsing, rendering, and style enhancement system in the astro-koharu blog project.

## Table of Contents

- [Markdown Configuration](#markdown-configuration)
- [Syntax Highlighting](#syntax-highlighting)
- [Style System](#style-system)
- [Content Enhancement](#content-enhancement)
- [Table of Contents Navigation](#table-of-contents-navigation)
- [Extended Features](#extended-features)

## Markdown Configuration

### Astro Markdown Settings

The project uses Astro's built-in Markdown processing capabilities, configured in `astro.config.mjs:15-37`:

```javascript
markdown: {
  // Enable GitHub Flavored Markdown
  gfm: true,

  // Rehype plugin configuration
  rehypePlugins: [
    rehypeSlug,                    // Automatically generate IDs for headings
    [
      rehypeAutolinkHeadings,      // Automatically generate anchor links for headings
      {
        behavior: 'append',
        properties: {
          className: ['anchor-link'],
        },
      },
    ],
  ],

  // Shiki syntax highlighting configuration
  shikiConfig: {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
}
```

**Key Features:**

- **GFM Support**: Enables GitHub Flavored Markdown, supporting tables, task lists, strikethrough, and other extended syntax.
- **Automatic ID Generation**: Uses `rehype-slug` to automatically generate URL-friendly IDs for all headings (h1-h6).
- **Automatic Anchor Links**: Uses `rehype-autolink-headings` to append clickable anchor icons after headings.

### Content Collections Configuration

Blog posts are managed using Astro Content Collections. The schema is defined in `src/content/config.ts:4-21`:

```typescript
const blogCollection = defineCollection({
  schema: z.object({
    title: z.string(),                       // Post title
    description: z.string().optional(),      // Description
    link: z.string().optional(),             // Custom link
    date: z.date(),                          // Publication date
    cover: z.string().optional(),            // Cover image
    tags: z.array(z.string()).optional(),    // Tags
    categories: z.array(z.string())          // Categories (nested support)
      .or(z.array(z.array(z.string())))
      .optional(),
    // Hexo compatibility fields
    subtitle: z.string().optional(),
    catalog: z.boolean().optional(),
    sticky: z.boolean().optional(),
  }),
});
```

**Characteristics:**

- Type-safe frontmatter validation
- Support for hierarchical category structures
- Maintained compatibility with Hexo blogs

## Syntax Highlighting

### Shiki Integration

The project uses Shiki for code syntax highlighting, supporting dual light/dark themes:

- **Light Theme**: `github-light` - suitable for daytime reading
- **Dark Theme**: `github-dark` - suitable for nighttime reading

Shiki performs syntax highlighting at build time. The generated HTML contains inline styles with zero runtime JavaScript requirement.

**Advantages:**

- Zero runtime overhead
- Accurate syntax highlighting (based on VSCode TextMate grammars)
- Automatic theme switching following system/user preferences

## Style System

### Tailwind Typography

The project uses the `@tailwindcss/typography` plugin to provide base typography styles, configured in `tailwind.config.mjs:138`:

```javascript
plugins: [
  require('@tailwindcss/typography'),
  // ... other plugins
];
```

Article content applies the `.prose` class to achieve elegant layout effects (see `src/pages/post/[...slug].astro:96`):

```html
<article class="prose md:prose-sm dark:prose-invert">
  <CustomContent Content={Content} />
</article>
```

**Styles Provided by Typography:**

- Appropriate font sizes and line heights
- Paragraph spacing and list indentation
- Default styles for links, blockquotes, and code blocks
- Responsive typography (via `md:prose-sm` modifier)
- Dark mode support (`dark:prose-invert`)

### Custom Markdown Styles

In `src/styles/theme/markdown.css`, deep customizations have been applied to `.prose`:

#### 1. Global Settings

```css
.prose {
  /* Remove default max-width restriction */
  max-width: none;
}
```

#### 2. Link Styles

```css
.prose a {
  @apply text-primary hover:text-blue no-underline transition-colors duration-300 hover:underline;
}
```

**Characteristics:**

- Uses theme color `text-primary`
- Turns blue with an underline on hover
- Smooth 300ms transition animation

#### 3. Heading Anchor Links

```css
/* Heading scroll offset to prevent being hidden under sticky headers */
.prose h1,
h2,
h3,
h4,
h5,
h6 {
  position: relative;
  scroll-margin-top: 4rem; /* 64px offset */
}

/* Anchor icon */
.prose a.anchor-link > span::before {
  content: '';
  width: 1em;
  height: 1em;
  position: absolute;
  right: -1.25em;
  top: 0.2em;
  opacity: 0;
  transition: opacity 0.3s;

  /* Use SVG mask to display # icon */
  background-color: currentColor;
  mask-image: url('data:image/svg+xml,...');
  /* ... */
}

/* Show anchor icon when hovering heading */
.prose h1:hover .anchor-link > span::before,
.prose h2:hover .anchor-link > span::before {
  opacity: 1;
}
```

**How It Works:**

1. `rehype-autolink-headings` inserts an `<a class="anchor-link">` element after each heading.
2. CSS `::before` pseudo-element displays a # icon on the right side of the heading.
3. Transparent by default, gradually appears on mouse hover.
4. `scroll-margin-top` ensures headings are not obscured by the fixed header when anchor links are clicked.

### Post Component Styles

`src/styles/components/post.css` provides Table of Contents (TOC) related styles:

```css
/* Custom scrollbar */
.toc-container::-webkit-scrollbar {
  width: 4px;
}
.toc-container::-webkit-scrollbar-thumb {
  background: hsl(var(--primary) / 0.3);
  border-radius: 2px;
}

/* TOC item hover effect */
.toc-item::before {
  content: '';
  position: absolute;
  left: 0;
  width: 0;
  height: 100%;
  background: hsl(var(--primary) / 0.1);
  transition: width 0.2s ease;
}
.toc-item:hover::before {
  width: 100%;
}
```

## Content Enhancement

### CustomContent Component

`src/components/common/CustomContent.astro` is responsible for rendering Markdown content and providing runtime enhancement features.

#### Component Configuration

```typescript
interface ContentConfig {
  addBlankTarget: boolean;   // Add target="_blank" to external links
  smoothScroll: boolean;      // Enable smooth scrolling
}
```

Default configuration (`src/constants/content-config.ts:8-11`):

```typescript
export const defaultContentConfig: ContentConfig = {
  addBlankTarget: true,
  smoothScroll: true,
};
```

#### Feature Implementation

1. **External Link Handling** (`CustomContent.astro:37-49`)

```javascript
// Add target="_blank" to all external links
if (config.addBlankTarget) {
  const links = contentContainer.querySelectorAll('a[href]');
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('http') || href.startsWith('//')) {
      link.setAttribute('target', '_blank');
    }
  });
}
```

2. **Smooth Scroll** (`CustomContent.astro:52-76`)

```javascript
if (config.smoothScroll) {
  const anchorLinks = contentContainer.querySelectorAll('a.anchor-link[href^="#"]');
  anchorLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href')?.substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        // Update URL hash
        history.pushState(null, '', `#${targetId}`);
      }
    });
  });
}
```

**Benefits:**

- Smooth scrolling to the target heading
- Updates URL without triggering a page reload
- Better user experience

#### Lifecycle

```javascript
// Re-run on Astro page switch
document.addEventListener('astro:page-load', enhanceContent);

// Run on initial load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceContent);
} else {
  enhanceContent();
}
```

## Table of Contents Navigation

### TableOfContents Component

`src/components/layout/TableOfContents/index.tsx` provides smart TOC navigation.

#### Core Features

1. **Automatic Heading Tree Extraction**

Uses custom Hook `useHeadingTree()` to extract all headings from the document and build a hierarchical structure.

2. **Active Heading Detection**

```typescript
const activeId = useActiveHeading({ offsetTop: 120 });
```

- Automatically detects currently visible heading during scroll
- Accounts for sticky header offset (120px)
- Highlights current heading in the TOC

3. **Accordion Expansion** (`TableOfContents/index.tsx:40-98`)

```typescript
const handleHeadingClick = useCallback((id: string) => {
  // Scroll to target heading
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Accordion logic:
  // 1. Close sibling headings
  // 2. Open parent heading chain
  // 3. Expand if child headings exist
  setExpandedIds((prev) => {
    // ... complex state management logic
  });
}, [headings, setExpandedIds]);
```

**User Experience:**

- Clicking a heading expands only that heading and its parents
- Automatically collapses other sibling headings to keep UI clean
- Smoothly scrolls to target location

4. **Hierarchical Rendering**

Recursively renders nested heading structures using `HeadingList` sub-components, supporting arbitrary heading depths.

### Sidebar Integration

The TOC is displayed in the sidebar on post detail pages (`src/components/layout/HomeSider.astro:56`):

```html
<div slot="directory" class="sider-slot" data-slot-type="directory">
  {type === HomeSiderType.POST && <TableOfContents client:load />}
</div>
```

**Sidebar Features:**

- Segmented controls (Info, TOC, Series)
- Smooth switching animations
- Responsive: hidden on mobile, fixed display on desktop
- Custom scrollbar styling

## Extended Features

### 1. Reading Time Calculation

While this document focuses on Markdown parsing and styling, it is worth noting that the project also includes reading time estimation capabilities.

Dependency: `reading-time` package (`package.json:54`)

Example usage:

```typescript
import readingTime from 'reading-time';
const stats = readingTime(post.body);
console.log(stats.text); // "5 min read"
```

### 2. RSS Feed

The project generates an RSS feed using content rendered from Markdown.

Location: `src/pages/rss.xml.ts`
Dependency: `@astrojs/rss` package (`package.json:20`)

### 3. SEO Optimization

Post detail pages (`src/pages/post/[...slug].astro:29-41`) include structured data (JSON-LD):

```javascript
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description: description || post.body?.slice(0, 100),
  keywords: categories?.length ? tags.concat(categories[0]) : tags,
  author: { '@type': 'Person', name: siteConfig.author },
  datePublished: parseDate(date, 'YYYY-MM-DD'),
};
```

**Benefits:**

- Helps search engines understand post content
- May display rich text snippets in search results
- Improves SEO and social media sharing effectiveness

## Best Practices

### Writing Markdown

1. **Use Semantic Headings**

   ```markdown
   # Post Title (only one h1)

   ## Main Section

   ### Subsection

   #### Details
   ```

2. **Leverage GFM Extensions**

   ```markdown
   | Header 1 | Header 2 |
   | -------- | -------- |
   | Content  | Content  |

   - [x] Completed task
   - [ ] Todo task

   ~~Strikethrough text~~
   ```

3. **Specify Language for Code Blocks**
   ````markdown
   ```typescript
   const hello: string = "world";
   ```
   ````

### Style Customization

1. **Extend Prose Styles**

   Add custom rules in `src/styles/theme/markdown.css`:

   ```css
   .prose blockquote {
     @apply border-primary/50 bg-primary/5 border-l-4 italic;
   }
   ```

2. **Add Custom Components**

   Use MDX components in Markdown:

   ```markdown
   import { Callout } from '@components/ui/Callout';

   <Callout type="warning">
   This is a warning alert box
   </Callout>
   ```

3. **Adjust Shiki Themes**

   Modify `shikiConfig.themes` in `astro.config.mjs` to use different code highlighting themes.

## File Index

**Configuration Files:**

- `astro.config.mjs:15-37` - Main Markdown configuration
- `tailwind.config.mjs:138` - Typography plugin
- `src/content/config.ts` - Content Collections Schema

**Style Files:**

- `src/styles/theme/markdown.css` - Custom Markdown styles
- `src/styles/components/post.css` - Post component styles
- `src/styles/global/tailwind.css` - Base Tailwind config

**Component Files:**

- `src/components/common/CustomContent.astro` - Content enhancement component
- `src/components/layout/TableOfContents/index.tsx` - TOC navigation component
- `src/components/layout/HomeSider.astro` - Sidebar container

**Page Files:**

- `src/pages/post/[...slug].astro` - Post detail page template

**Constant Configurations:**

- `src/constants/content-config.ts` - Content enhancement configuration

## Summary

astro-koharu's Markdown system provides powerful and elegant content rendering capabilities through the following technology stack:

- **Astro + Rehype** - Flexible Markdown processing pipeline
- **Shiki** - High-quality syntax highlighting
- **Tailwind Typography** - Professional typography foundation
- **Custom CSS** - Fine-grained style control
- **React Enhancement Components** - Dynamic interactive features (TOC, smooth scroll)

While keeping the system clean and easy to use, it delivers an outstanding reading experience for readers and powerful content expression capabilities for authors.
