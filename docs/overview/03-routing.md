# Routing System Detailed Guide

## Astro File-Based Routing Fundamentals

Astro uses **file-system routing**, where files under the `src/pages/` directory are automatically mapped to URL paths:

```plain
src/pages/
├── index.astro          →  /
├── about.md             →  /about
├── archives.astro       →  /archives
├── friends.astro        →  /friends
├── weekly.astro         →  /weekly
├── rss.xml.ts           →  /rss.xml
├── post/
│   └── [...slug].astro  →  /post/*
├── posts/
│   └── [...page].astro  →  /posts/*, /posts/2, /posts/3
├── categories/
│   ├── index.astro      →  /categories
│   └── [...slug].astro  →  /categories/*
└── tags/
    ├── index.astro      →  /tags
    └── [...slug].astro  →  /tags/*
```

### Route Types

| Type | Syntax | Example | Description |
| --- | --- | --- | --- |
| Static Route | `page.astro` | `about.md` → `/about` | Fixed URL |
| Dynamic Route | `[param].astro` | `[tag].astro` → `/tags/react` | Single-level parameter |
| Rest Parameter | `[...slug].astro` | `[...slug].astro` → `/a/b/c` | Multi-level parameter |

---

## Dynamic Route Implementation

### 1. Article Detail Page `post/[...slug].astro`

Article detail pages use the rest parameter `[...slug]` to match article URLs:

```astro
---
// src/pages/post/[...slug].astro

import { getSortedPosts } from '@lib/content';

// getStaticPaths: Tells Astro which pages need to be generated
export async function getStaticPaths() {
  const postCollections = await getSortedPosts();

  return postCollections.map((post) => {
    // Prioritize custom link, otherwise use file slug
    const link = post.data?.link ?? post.slug;

    return {
      params: { slug: link }, // URL parameters
      props: { post }, // Data passed to the page
    };
  });
}

// Get post data from props
const { post } = Astro.props;
const { Content } = await post.render(); // Render Markdown content
---

<Layout title={post.data.title}>
  <article class="prose">
    <Content />
  </article>
</Layout>
```

**Generated Pages Example**:

```plain
Post file: src/content/blog/note/front-end/react-hooks.md
frontmatter: { link: 'react-hooks-guide' }

Generated URL: /post/react-hooks-guide

If no link field:
Generated URL: /post/note/front-end/react-hooks
```

### 2. Category Page `categories/[...slug].astro`

Category pages support multi-level category paths:

```astro
---
// src/pages/categories/[...slug].astro

import { getCategoryByLink, getCategoryLinks, getCategoryList } from '@lib/content';

export async function getStaticPaths() {
  // 1. Get all categories
  const { categories } = await getCategoryList();

  // 2. Generate URL links for all categories
  const links = getCategoryLinks(categories, '');
  // links = ['life', 'note', 'note/front-end', 'note/front-end/react', ...]

  // 3. Generate pages for each link
  return links.map((link) => {
    const category = getCategoryByLink(categories, link);
    return {
      params: { slug: link },
      props: { category },
    };
  });
}

const { category } = Astro.props;
---

<Layout title={`Category - ${category?.name}`}>
  <CategoryPostList category={category} />
</Layout>
```

**Generated Pages**:

```plain
/categories/life           → Life / Essays Category
/categories/note           → Notes Category
/categories/note/front-end → Notes > Front-End Category
/categories/note/front-end/react → Notes > Front-End > React Category
```

### 3. Article List Pagination `posts/[...page].astro`

Uses Astro's built-in `paginate` function to implement pagination:

```astro
---
// src/pages/posts/[...page].astro

import { getNonWeeklyPosts } from '@lib/content';
import type { PaginateFunction } from 'astro';

export async function getStaticPaths({ paginate }: { paginate: PaginateFunction }) {
  // Get all non-weekly posts
  const postCollections = await getNonWeeklyPosts();

  // paginate automatically generates paginated routes
  return paginate(postCollections, { pageSize: 10 });
}

// page object contains pagination information
const { page } = Astro.props;
---

<Layout>
  <PostList posts={page.data} page={page} />
</Layout>
```

**`page` Object Structure**:

```typescript
interface Page<T> {
  data: T[];           // Data for current page
  start: number;       // Starting index
  end: number;         // Ending index
  size: number;        // Page size
  total: number;       // Total number of items
  currentPage: number; // Current page number
  lastPage: number;    // Last page number
  url: {
    current: string;   // Current page URL
    prev?: string;     // Previous page URL
    next?: string;     // Next page URL
    first: string;     // First page URL
    last: string;      // Last page URL
  };
}
```

**Generated Pages**:

```plain
/posts/1  → Page 1 (10 posts)
/posts/2  → Page 2 (10 posts)
/posts/3  → Page 3 (10 posts)
...
```

---

## Home Page Route `index.astro`

The home page is a special static page that manually constructs pagination data:

```astro
---
// src/pages/index.astro

import { getLatestWeeklyPost, getNonWeeklyPostsBySticky } from '@lib/content';

// 1. Get sticky posts and regular posts
const { stickyPosts: normalStickyPosts, allPosts: allNonWeeklyPosts } = await getNonWeeklyPostsBySticky();

// 2. Get latest weekly post (special display)
const latestWeeklyPost = await getLatestWeeklyPost();

// 3. Put weekly post at the beginning of the sticky list
const stickyPosts = latestWeeklyPost ? [latestWeeklyPost, ...normalStickyPosts] : normalStickyPosts;

// 4. Home page displays first 10 regular posts
const posts = allNonWeeklyPosts.slice(0, 10);

// 5. Manually construct Page object (for paginator component)
const page: Page<BlogPost> = {
  data: posts,
  start: 0,
  end: Math.min(9, posts.length - 1),
  size: 10,
  total: allNonWeeklyPosts.length,
  currentPage: 1,
  lastPage: Math.ceil(allNonWeeklyPosts.length / 10),
  url: {
    current: '/',
    prev: undefined,
    next: allNonWeeklyPosts.length > 10 ? '/posts/2' : undefined,
    first: '/',
    last: `/posts/${Math.ceil(allNonWeeklyPosts.length / 10)}`,
  },
};
---

<Layout>
  <!-- Sticky posts section -->
  <Divider>Sticky Posts</Divider>
  <PostList posts={stickyPosts} showPaginator={false} />

  <!-- Regular post list -->
  <Divider>Post List</Divider>
  <PostList posts={posts} page={page} baseUrl="/posts" />

  <!-- Featured categories -->
  <Divider>Featured Categories</Divider>
  <CategoryCards />
</Layout>
```

---

## RSS Feed Generation `rss.xml.ts`

RSS uses a TypeScript endpoint (`.ts` file) to generate XML:

```typescript
// src/pages/rss.xml.ts

import rss from '@astrojs/rss';
import { siteConfig } from '@constants/site-config';
import { getSortedPosts } from '@lib/content';
import { getSanitizeHtml } from '@lib/sanitize';
import type { APIContext } from 'astro';
import sanitizeHtml from 'sanitize-html';

// Generate plain text summary
const generateTextSummary = (html?: string, length: number = 150): string => {
  const text = sanitizeHtml(html ?? '', {
    allowedTags: [],  // Remove all HTML tags
    allowedAttributes: {},
  });

  if (text.length <= length) return text;
  return text.substring(0, length).replace(/\s+\S*$/, '');  // Do not truncate words
};

// GET Endpoint - Returns RSS XML
export async function GET(context: APIContext) {
  const posts = await getSortedPosts();
  const { site } = context;

  if (!site) {
    throw new Error('Missing site metadata');
  }

  return rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site,
    trailingSlash: false,
    stylesheet: '/rss/cos-feed.xsl',  // RSS stylesheet

    // Only include latest 20 posts
    items: posts
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data?.description ?? generateTextSummary(post.rendered?.html),
        link: `/post/${post.data.link ?? post.slug}`,
        content: getSanitizeHtml(post.rendered?.html ?? ''),
      }))
      .slice(0, 20),
  });
}
```

**RSS Output Example**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>余弦の博客</title>
    <link>https://blog.cosine.ren/</link>
    <description>WA 的一声就哭了</description>
    <item>
      <title>React Hooks 学习笔记</title>
      <link>https://blog.cosine.ren/post/react-hooks</link>
      <pubDate>Mon, 15 Jan 2024 00:00:00 GMT</pubDate>
      <description>深入理解 React Hooks...</description>
    </item>
    <!-- More posts... -->
  </channel>
</rss>
```

---

## Static Path Generation Flow

### How `getStaticPaths()` Works

```plain
Executed at build time
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│              getStaticPaths() Function Execution            │
│                                                             │
│  1. Read all content sources (Content Collections)          │
│  2. Compute all URLs that need to be generated              │
│  3. Return array of { params, props }                       │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│              Astro Generates Pages for Each Path            │
│                                                             │
│  /post/react-hooks     → dist/post/react-hooks/index.html   │
│  /post/vue-basics      → dist/post/vue-basics/index.html    │
│  /categories/note      → dist/categories/note/index.html    │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Static HTML Files                        │
│                  (Deployable to CDN)                        │
└─────────────────────────────────────────────────────────────┘
```

### Route Generation Example

Suppose there are the following posts:

```plain
src/content/blog/
├── tools/git-tips.md           # categories: ['工具']
├── note/front-end/react.md     # categories: [['笔记', '前端', 'React']]
└── note/algorithm/sorting.md   # categories: [['笔记', '算法']]
```

**Generated Routes**:

```plain
# Post pages
/post/git-tips
/post/note/front-end/react (or custom link)
/post/note/algorithm/sorting

# Category pages
/categories/tools
/categories/note
/categories/note/front-end
/categories/note/front-end/react
/categories/note/algorithm
```

---

## Breadcrumb Navigation Implementation

Post pages include breadcrumb navigation showing category hierarchy:

```astro
---
// src/pages/post/[...slug].astro

const categoryArr = getCategoryArr(categories?.[0]);
// categoryArr = ['笔记', '前端', 'React']

// Generate breadcrumb data
const breadcrumbCategories = [];
if (categoryArr?.length) {
  for (let i = 0; i < categoryArr.length; i++) {
    const partialCategories = categoryArr.slice(0, i + 1);
    const link = await buildCategoryPath(partialCategories);
    breadcrumbCategories.push({
      name: categoryArr[i],
      link: link,
    });
  }
}

// Result:
// [
//   { name: '笔记', link: '/categories/note' },
//   { name: '前端', link: '/categories/note/front-end' },
//   { name: 'React', link: '/categories/note/front-end/react' }
// ]
---

<!-- Breadcrumb rendering -->
<nav class="flex items-center gap-2 text-sm">
  <a href="/">Home</a>

  {
    breadcrumbCategories.map((category, index) => (
      <>
        <Icon name="ri:arrow-right-s-line" />
        <a href={category.link}>{category.name}</a>
      </>
    ))
  }
</nav>

<!-- Display effect: Home > Notes > Front-End > React -->
```

---

## JSON-LD Structured Data

Post pages include SEO structured data:

```astro
---
// src/pages/post/[...slug].astro

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description: description || post.body?.slice(0, 100),
  keywords: categories?.length ? tags.concat(categories[0]) : tags,
  author: {
    '@type': 'Person',
    name: siteConfig.author ?? siteConfig.name,
    url: Astro.site,
  },
  datePublished: parseDate(date, 'YYYY-MM-DD'),
};
---

<!-- Inject into head -->
<script is:inline slot="head" type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

**Output JSON-LD**:

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "React Hooks 学习笔记",
  "description": "深入理解 React Hooks 的工作原理",
  "keywords": ["React", "Hooks", "前端", "笔记"],
  "author": {
    "@type": "Person",
    "name": "cos",
    "url": "https://blog.cosine.ren/"
  },
  "datePublished": "2024-01-15"
}
```

---

## Route Configuration Options

### `trailingSlash` Configuration

Configure URL trailing slash handling in `astro.config.mjs`:

```javascript
// astro.config.mjs
export default defineConfig({
  trailingSlash: 'ignore', // Both /about and /about/ are valid
  // 'always' - Force trailing slash
  // 'never' - Force no trailing slash
  // 'ignore' - Accept both
});
```

### Custom 404 Page

Create `src/pages/404.astro` to customize the 404 page:

```astro
---
// src/pages/404.astro
import Layout from '@layouts/Layout.astro';
---

<Layout title="Page Not Found">
  <div class="flex-center min-h-screen">
    <h1>404 - Page Not Found</h1>
    <a href="/">Back to Home</a>
  </div>
</Layout>
```

---

## Routing System Flowchart

```plain
┌─────────────────────────────────────────────────────────────┐
│                        User Request                         │
│                    GET /post/react-hooks                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Route Matching                        │
│                                                             │
│  /post/react-hooks matches src/pages/post/[...slug].astro   │
│  params = { slug: 'react-hooks' }                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Static Page Lookup                       │
│                                                             │
│  Find dist/post/react-hooks/index.html                      │
│  (Generated at build time)                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Return HTML                         │
│                                                             │
│  Content-Type: text/html                                    │
│  HTTP 200 OK                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **File-System Routing**: Files under `src/pages/` automatically map to URLs
2. **Dynamic Route Parameters**:
   - `[param]` matches single-level path
   - `[...slug]` matches multi-level path
3. **`getStaticPaths()`**: Tells Astro which static pages to generate
4. **`paginate()` Function**: Automatically handles pagination logic
5. **RSS Endpoint**: Uses `.ts` files to generate non-HTML content
6. **SEO Optimization**: JSON-LD structured data enhances search engine comprehension

---

## Related Files

| File | Description |
| --- | --- |
| `src/pages/index.astro` | Home page |
| `src/pages/post/[...slug].astro` | Post detail page |
| `src/pages/posts/[...page].astro` | Post list pagination |
| `src/pages/categories/[...slug].astro` | Category page |
| `src/pages/categories/index.astro` | Category index |
| `src/pages/tags/[...slug].astro` | Tag page |
| `src/pages/rss.xml.ts` | RSS feed |
| `src/pages/archives.astro` | Archives page |
| `src/pages/weekly.astro` | Weekly page |
| `src/pages/friends.astro` | Friends page |
