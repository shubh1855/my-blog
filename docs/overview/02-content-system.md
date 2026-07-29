# Content System Deep Dive

## Overview

astro-koharu's content system is based on **Astro Content Collections**, which is Astro's native content management solution. It provides type-safe content queries, Markdown/MDX support, and flexible Schema validation.

The content system in this project also includes a complex **category system** designed to handle multi-level category structures migrated from Hexo.

---

## Astro Content Collections Fundamentals

### What are Content Collections?

Content Collections are Astro's official way to manage content, organizing Markdown/MDX files into queryable collections:

```plain
src/content/
├── config.ts          # Schema definition
└── blog/              # blog collection
    ├── life/
    │   └── post1.md
    ├── note/
    │   ├── front-end/
    │   │   └── react-learning.md
    │   └── algorithm/
    │       └── sorting.md
    └── weekly/
        └── issue-01.md
```

### Core Advantages

1. **Type Safety**: Schema validation + TypeScript type inference
2. **Automatic Parsing**: Markdown frontmatter automatically converted to objects
3. **High-Performance Querying**: Statically generated at build time, zero runtime overhead
4. **Flexible Organization**: Supports nested directory structures

---

## Schema Definition

### Configuration File `src/content/config.ts`

```typescript
import type { BlogSchema } from 'types/blog';
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  schema: z.object({
    // Required fields
    title: z.string(),              // Article title
    date: z.date(),                 // Publication date

    // Optional fields
    description: z.string().optional(),  // Article description/summary
    link: z.string().optional(),         // Custom URL identifier
    cover: z.string().optional(),        // Cover image path
    tags: z.array(z.string()).optional(), // Tag array

    // Hexo compatibility fields
    subtitle: z.string().optional(),     // Subtitle (legacy Hexo)
    catalog: z.boolean().optional(),     // Whether to show table of contents
    sticky: z.boolean().optional(),      // Whether sticky/pinned

    // Category field (supports two formats)
    categories: z
      .array(z.string())                    // Format 1: ['Tools']
      .or(z.array(z.array(z.string())))     // Format 2: [['Notes', 'Front-End', 'React']]
      .optional(),
  }) satisfies z.ZodType<BlogSchema>,
});

export const collections = {
  blog: blogCollection,
};
```

### Schema Field Descriptions

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | `string` | Yes | Article title |
| `date` | `Date` | Yes | Publication date |
| `description` | `string` | No | SEO description/summary |
| `link` | `string` | No | Custom URL (defaults to filename) |
| `cover` | `string` | No | Cover image path |
| `tags` | `string[]` | No | Tag array |
| `categories` | See below | No | Category (supports multi-level) |
| `sticky` | `boolean` | No | Sticky flag |
| `catalog` | `boolean` | No | Whether to generate catalog/TOC (Hexo legacy) |
| `subtitle` | `string` | No | Subtitle (Hexo legacy) |

---

## Category System Implementation

### Category Format Support

The project supports two category formats to ensure compatibility with historical Hexo data:

```yaml
# Format 1: Single-level category
categories:
  - 工具

# Format 2: Multi-level category (Recommended)
categories:
  - [笔记, 前端, React]
```

These two formats are processed uniformly in code:

```typescript
// src/lib/content/posts.ts
const firstCategory = categories[0];

if (Array.isArray(firstCategory)) {
  // Format 2: Multi-level category ['笔记', '前端', 'React']
  return firstCategory.includes(categoryName);
} else if (typeof firstCategory === 'string') {
  // Format 1: Single-level category '工具'
  return firstCategory === categoryName;
}
```

### Category Mapping `_config.yml`

Since Chinese characters cannot be used directly in URLs, the project uses a mapping table to translate Chinese category names to English slugs:

```yaml
# _config.yml
category_map:
  随笔: life
  笔记: note
  前端: front-end
  React: react
  工具: tools
  周刊: weekly
  # ... total of 22 category mappings
```

The mapping table is exported in `src/constants/category.ts`:

```typescript
// src/constants/category.ts
export const categoryMap: Record<string, string> = {
  '随笔': 'life',
  '笔记': 'note',
  '前端': 'front-end',
  // ...
};
```

### Category Tree Structure

Categories are organized in a tree structure, supporting infinitely nested levels:

```typescript
// src/lib/content/types.ts
type Category = {
  name: string;           // Category name (Chinese)
  children?: Category[];  // Child categories
};
```

Example of an actual category tree:

```plain
笔记
├── 前端
│   ├── JavaScript
│   └── React
├── 后端
├── 算法
└── CS基础
    └── 数据结构
```

---

## Core Functions Detailed

### 1. Get Category List `getCategoryList()`

```typescript
// src/lib/content/categories.ts
export async function getCategoryList(): Promise<CategoryListResult> {
  const allBlogPosts = await getCollection('blog');
  const countMap: { [key: string]: number } = {};  // Category post counts
  const resCategories: Category[] = [];            // Category tree

  for (const post of allBlogPosts) {
    const { catalog, categories } = post.data;
    if (!catalog || !categories?.length) continue;

    const firstCategory = categories[0];

    if (Array.isArray(firstCategory)) {
      // Multi-level category: ['笔记', '前端', 'React']
      for (let j = 0; j < firstCategory.length; ++j) {
        const name = firstCategory[j];
        countMap[name] = (countMap[name] || 0) + 1;

        // Recursively build category tree
        if (j === 0) {
          addCategoryRecursively(resCategories, [], name);
        } else {
          const parentNames = firstCategory.slice(0, j);
          addCategoryRecursively(resCategories, parentNames, name);
        }
      }
    } else if (typeof firstCategory === 'string') {
      // Single-level category: '工具'
      countMap[firstCategory] = (countMap[firstCategory] || 0) + 1;
      addCategoryRecursively(resCategories, [], firstCategory);
    }
  }

  return { categories: resCategories, countMap };
}
```

**Return Value Structure**:

```typescript
{
  categories: [
    {
      name: '笔记',
      children: [
        { name: '前端', children: [{ name: 'React' }] },
        { name: '算法' }
      ]
    },
    { name: '工具' }
  ],
  countMap: {
    '笔记': 50,
    '前端': 30,
    'React': 15,
    '工具': 10
  }
}
```

### 2. Recursively Add Category `addCategoryRecursively()`

This is the core recursive function for building the category tree:

```typescript
// src/lib/content/categories.ts
export function addCategoryRecursively(
  rootCategories: Category[],
  parentNames: string[],
  name: string
) {
  if (parentNames.length === 0) {
    // Root category: add directly
    const index = rootCategories.findIndex((c) => c.name === name);
    if (index === -1) rootCategories.push({ name });
  } else {
    // Sub-category: find parent category then recurse
    const rootParentName = parentNames[0];
    const index = rootCategories.findIndex((c) => c.name === rootParentName);

    if (index === -1) {
      // Parent category does not exist, create it
      const rootParentCategory = { name: rootParentName, children: [] };
      rootCategories.push(rootParentCategory);
      addCategoryRecursively(rootParentCategory.children, parentNames.slice(1), name);
    } else {
      // Parent category exists, continue recursion
      const rootParentCategory = rootCategories[index];
      if (!rootParentCategory?.children) rootParentCategory.children = [];
      addCategoryRecursively(rootParentCategory.children, parentNames.slice(1), name);
    }
  }
}
```

**Execution Flow Example**:

```plain
Input: ['笔记', '前端', 'React']

Step 1: addCategoryRecursively([], [], '笔记')
  → categories = [{ name: '笔记' }]

Step 2: addCategoryRecursively([], ['笔记'], '前端')
  → categories = [{ name: '笔记', children: [{ name: '前端' }] }]

Step 3: addCategoryRecursively([], ['笔记', '前端'], 'React')
  → categories = [{
      name: '笔记',
      children: [{
        name: '前端',
        children: [{ name: 'React' }]
      }]
    }]
```

### 3. Build Category Path `buildCategoryPath()`

Converts an array of category names into a URL path:

```typescript
// src/lib/content/categories.ts
export function buildCategoryPath(categoryNames: string | string[]): string {
  if (!categoryNames) return '';

  const names = Array.isArray(categoryNames) ? categoryNames : [categoryNames];
  if (names.length === 0) return '';

  const slugs = names.map((name) => categoryMap[name]);
  return '/categories/' + slugs.join('/');
}

// Example
buildCategoryPath(['笔记', '前端', 'React'])
// → '/categories/note/front-end/react'

buildCategoryPath('工具')
// → '/categories/tools'
```

### 4. Get Category by Link `getCategoryByLink()`

Reverse lookup of category object from URL path:

```typescript
// src/lib/content/categories.ts
export function getCategoryByLink(
  categories: Category[],
  link?: string
): Category | null {
  const name = getCategoryNameByLink(link ?? '');
  if (!name || !categories?.length) return null;

  for (const category of categories) {
    if (category.name === name) return category;

    // Recursively search child categories
    if (category?.children?.length) {
      const res = getCategoryByLink(category.children, link);
      if (res) return res;
    }
  }
  return null;
}
```

---

## Article Query Functions

### Get Sorted Posts `getSortedPosts()`

```typescript
// src/lib/content/posts.ts
export async function getSortedPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');

  // Sort in descending order by date (newest first)
  return posts.sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
  });
}
```

### Get Sticky Posts `getPostsBySticky()`

```typescript
// src/lib/content/posts.ts
export async function getPostsBySticky(): Promise<{
  stickyPosts: CollectionEntry<'blog'>[];
  nonStickyPosts: CollectionEntry<'blog'>[];
}> {
  const posts = await getSortedPosts();

  const stickyPosts: CollectionEntry<'blog'>[] = [];
  const nonStickyPosts: CollectionEntry<'blog'>[] = [];

  for (const post of posts) {
    if (post.data?.sticky) {
      stickyPosts.push(post);
    } else {
      nonStickyPosts.push(post);
    }
  }

  return { stickyPosts, nonStickyPosts };
}
```

### Get Posts by Category `getPostsByCategory()`

```typescript
// src/lib/content/posts.ts
export async function getPostsByCategory(categoryName: string): Promise<BlogPost[]> {
  const posts = await getSortedPosts();

  return posts.filter((post) => {
    const { categories } = post.data;
    if (!categories?.length) return false;

    const firstCategory = categories[0];

    // Handle two category formats
    if (Array.isArray(firstCategory)) {
      return firstCategory.includes(categoryName);
    } else if (typeof firstCategory === 'string') {
      return firstCategory === categoryName;
    }
    return false;
  });
}
```

### Get Series Posts `getSeriesPosts()`

Series posts refer to all posts under the same deepest category level:

```typescript
// src/lib/content/posts.ts
export async function getSeriesPosts(post: BlogPost): Promise<BlogPost[]> {
  const lastCategory = getPostLastCategory(post);
  if (!lastCategory.name) return [];

  return await getPostsByCategory(lastCategory.name);
}

// Get the deepest category level of a post
export function getPostLastCategory(post: BlogPost): { link: string; name: string } {
  const { categories } = post.data;
  if (!categories?.length) return { link: '', name: '' };

  const firstCategory = categories[0];

  if (Array.isArray(firstCategory)) {
    // ['笔记', '前端', 'React'] → returns 'React'
    return {
      link: buildCategoryPath(firstCategory),
      name: firstCategory[firstCategory.length - 1],
    };
  } else if (typeof firstCategory === 'string') {
    return {
      link: buildCategoryPath(firstCategory),
      name: firstCategory,
    };
  }

  return { link: '', name: '' };
}
```

### Get Adjacent Series Posts `getAdjacentSeriesPosts()`

Used for "Previous / Next" post navigation on post details pages:

```typescript
// src/lib/content/posts.ts
export async function getAdjacentSeriesPosts(currentPost: BlogPost): Promise<{
  prevPost: BlogPost | null;
  nextPost: BlogPost | null;
}> {
  const seriesPosts = await getSeriesPosts(currentPost);

  if (seriesPosts.length === 0) {
    return { prevPost: null, nextPost: null };
  }

  const currentIndex = seriesPosts.findIndex(
    (post) => post.slug === currentPost.slug
  );

  if (currentIndex === -1) {
    return { prevPost: null, nextPost: null };
  }

  // Because posts are sorted by date descending (newest first)
  // prevPost is the newer post (index - 1)
  // nextPost is the older post (index + 1)
  const prevPost = currentIndex > 0 ? seriesPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < seriesPosts.length - 1
    ? seriesPosts[currentIndex + 1]
    : null;

  return { prevPost, nextPost };
}
```

---

## Weekly Column Feature

The project supports a special "Weekly" category displayed separately from regular posts:

```typescript
// src/lib/content/posts.ts

// Get all weekly posts
export async function getWeeklyPosts(): Promise<BlogPost[]> {
  const { featuredSeries } = siteConfig;
  if (!featuredSeries?.enabled || !featuredSeries.categoryName) {
    return [];
  }

  return await getPostsByCategory(featuredSeries.categoryName);
}

// Get latest weekly post
export async function getLatestWeeklyPost(): Promise<BlogPost | null> {
  const weeklyPosts = await getWeeklyPosts();
  return weeklyPosts[0] ?? null;
}

// Get non-weekly posts (used on home page)
export async function getNonWeeklyPosts(): Promise<BlogPost[]> {
  const { featuredSeries } = siteConfig;
  if (!featuredSeries?.enabled || !featuredSeries.categoryName) {
    return await getSortedPosts();
  }

  const allPosts = await getSortedPosts();
  return allPosts.filter(
    (post) => !isPostInCategory(post, featuredSeries.categoryName)
  );
}
```

---

## Article Frontmatter Examples

### Basic Article

```yaml
---
title: React Hooks 学习笔记
date: 2024-01-15
description: 深入理解 React Hooks 的工作原理
tags:
  - React
  - Hooks
  - 前端
categories:
  - [笔记, 前端, React]
catalog: true
---
Article content...
```

### Sticky Article

```yaml
---
title: 网站公告
date: 2024-03-01
sticky: true
categories:
  - 随笔
---
```

### Custom Link

```yaml
---
title: 非常长的文章标题
link: short-url
date: 2024-02-20
---
# Access path will be /post/short-url instead of filename
```

---

## Data Flow Diagram

```plain
┌─────────────────────────────────────────────────────────────┐
│                    Markdown Files                           │
│   src/content/blog/note/front-end/react-hooks.md           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Schema Validation                        │
│   src/content/config.ts → z.object({...})                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Content Collection API                      │
│   getCollection('blog') → CollectionEntry<'blog'>[]        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Utility Processing                       │
│   ┌─────────────────┐  ┌─────────────────┐                 │
│   │  posts.ts       │  │  categories.ts  │                 │
│   │  - getSorted    │  │  - getList      │                 │
│   │  - getByCategory│  │  - buildPath    │                 │
│   │  - getSeries    │  │  - getByLink    │                 │
│   └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Page Components                          │
│   ┌─────────────────┐  ┌─────────────────┐                 │
│   │  PostList.astro │  │ CategoryList    │                 │
│   │  PostCard.astro │  │ .astro          │                 │
│   └─────────────────┘  └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Static HTML Output                       │
│   dist/post/react-hooks/index.html                         │
│   dist/categories/note/front-end/react/index.html          │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Content Collections**: Astro native content management providing type safety and Schema validation
2. **Dual-Format Categories**: Compatible with Hexo single-level and multi-level category formats
3. **Category Mapping**: Chinese category name → English slug conversion mechanism
4. **Recursive Algorithm**: Category tree construction and traversal
5. **Utility Layering**:
   - `posts.ts`: Article queries (sorting, filtering, pagination)
   - `categories.ts`: Category operations (building, searching, path generation)
   - `tags.ts`: Tag statistics

---

## Related Files

| File | Description |
| --- | --- |
| `src/content/config.ts` | Schema definition |
| `src/content/blog/` | Blog post directory |
| `src/lib/content/posts.ts` | Article query functions |
| `src/lib/content/categories.ts` | Category processing functions |
| `src/lib/content/tags.ts` | Tag processing functions |
| `src/lib/content/types.ts` | Type definitions |
| `src/constants/category.ts` | Category mapping table |
| `_config.yml` | Hexo category mapping source file |
