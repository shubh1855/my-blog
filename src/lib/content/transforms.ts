/**
 * Data transformation utilities for BlogPost
 * Converts heavy BlogPost objects to lightweight interfaces for component props
 *
 * Uses a flexible pick-based API that allows selecting specific fields on demand
 */

import { defaultLocale } from '@/i18n/config';
import type { BlogPost } from '@/types/blog';
import { getPostLocale, getPostSlug } from './locale';
import { getPostDescriptionWithSummary, getPostLastCategory, getPostReadingTime } from './posts';

/**
 * Extractable field map for BlogPost
 * - Direct fields: read directly from post.slug or post.data.xxx
 * - Computed fields: require function calls to compute
 */
export type PostFieldMap = {
  // Direct fields
  slug: string;
  link: string | undefined;
  title: string;
  date: Date;
  cover: string | undefined;
  tags: string[] | undefined;
  categories: string[] | string[][] | undefined;
  draft: boolean | undefined;
  // Computed fields
  categoryName: string | undefined; // from getPostLastCategory()
  description: string; // from getPostDescriptionWithSummary()
  wordCount: number; // from reading-time
  readingTime: string; // from reading-time
  postLocale: string; // from getPostLocale()
};

/**
 * Field extractor map
 * Each field maps to a function that extracts the value from a BlogPost
 */
const fieldExtractors: { [K in keyof PostFieldMap]: (post: BlogPost, locale: string) => PostFieldMap[K] } = {
  // Direct fields
  slug: (p) => getPostSlug(p),
  link: (p) => p.data?.link,
  title: (p) => p.data.title,
  date: (p) => p.data.date,
  cover: (p) => p.data?.cover,
  tags: (p) => p.data?.tags,
  categories: (p) => p.data?.categories,
  draft: (p) => p.data?.draft,
  // Computed fields
  categoryName: (p) => getPostLastCategory(p).name || undefined,
  description: (p, locale) => getPostDescriptionWithSummary(p, locale),
  wordCount: (p) => getPostReadingTime(p).words,
  readingTime: (p) => getPostReadingTime(p).text,
  postLocale: (p) => getPostLocale(p),
};

/**
 * Pick specified fields from a BlogPost
 * @example pickPost(post, ['slug', 'link', 'title'])
 * @example pickPost(post, ['slug', 'link', 'title', 'categoryName'])
 */
function pickPost<K extends keyof PostFieldMap>(
  post: BlogPost,
  keys: readonly K[],
  locale: string = defaultLocale,
): Pick<PostFieldMap, K> {
  const result = {} as Pick<PostFieldMap, K>;
  for (const key of keys) {
    result[key] = fieldExtractors[key](post, locale);
  }
  return result;
}

/**
 * Batch pick specified fields from a BlogPost array
 * @example pickPosts(posts, ['slug', 'link', 'title'])
 * @example pickPosts(posts, ['slug', 'link', 'title', 'categoryName'])
 */
function pickPosts<K extends keyof PostFieldMap>(
  posts: BlogPost[],
  keys: readonly K[],
  locale: string = defaultLocale,
): Pick<PostFieldMap, K>[] {
  return posts.map((post) => pickPost(post, keys, locale));
}

// Convenience aliases — backward compatible

/** Fields required for PostRef */
const POST_REF_KEYS = ['slug', 'link', 'title'] as const;

/** Fields required for PostCardData */
const POST_CARD_DATA_KEYS = [
  'slug',
  'link',
  'title',
  'description',
  'date',
  'cover',
  'tags',
  'categories',
  'draft',
  'wordCount',
  'readingTime',
  'postLocale',
] as const;

/** Fields required for PostRefWithCategory */
const POST_REF_WITH_CATEGORY_KEYS = ['slug', 'link', 'title', 'categoryName'] as const;

/**
 * Convert to a reference with category (4 fields: slug, link, title, categoryName)
 */
export const toPostRefWithCategory = (post: BlogPost) => pickPost(post, POST_REF_WITH_CATEGORY_KEYS);
/**
 * Convert to a minimal reference (3 fields: slug, link, title)
 */
export const toPostRef = (post: BlogPost) => pickPost(post, POST_REF_KEYS);

// Batch conversion helpers
export const toPostRefs = (posts: BlogPost[]) => pickPosts(posts, POST_REF_KEYS);

export const toPostCardDataList = (posts: BlogPost[], locale: string = defaultLocale) =>
  pickPosts(posts, POST_CARD_DATA_KEYS, locale);
