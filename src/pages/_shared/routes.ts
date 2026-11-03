/**
 * Single declaration site for every localized dynamic route's parameter space.
 *
 * Each route is declared once here and consumed twice: the root page exports
 * `<route>.root` and its `[lang]/` mirror exports `<route>.mirror`.
 */

import { PAGINATION } from '@constants/layout';
import { siteConfig } from '@constants/site-config';
import {
  getCategoryByLink,
  getCategoryLinks,
  getCategoryList,
  getEnabledSeries,
  getNonFeaturedPosts,
  getPostSlug,
  getSortedPosts,
  normalizeTag,
} from '@lib/content';
import { localePaths } from './utils';

/** Tags can contain `/`, which is not usable as a single route segment. */
const toTagParam = (tag: string) => normalizeTag(tag).replace(/\//g, '-');

export const postRoute = localePaths(async ({ locale }) => {
  const posts = await getSortedPosts(locale);
  return posts.map((post) => ({ params: { slug: getPostSlug(post) }, props: { postId: post.id } }));
});

export const tagRoute = localePaths(async ({ locale }) => {
  const posts = await getSortedPosts(locale);
  const tags = new Set(posts.flatMap((post) => (post.data.tags ?? []).map(normalizeTag)));
  return [...tags].map((tag) => ({ params: { tag: toTagParam(tag) }, props: { tag } }));
});

export const categoryRoute = localePaths(async ({ locale }) => {
  const { categories } = await getCategoryList(locale);
  // This also fails the build for unmapped names or colliding URLs in this locale's actual tree.
  const links = getCategoryLinks(categories, '');
  const publishedLinks = new Set(links);
  const published = links.map((link) => ({
    params: { slug: link },
    props: { category: getCategoryByLink(categories, link), placeholderCategory: null },
  }));
  const placeholders = (siteConfig.featuredCategories ?? [])
    .filter((featured) => featured.comingSoon && !publishedLinks.has(featured.link))
    .map((featured) => ({
      params: { slug: featured.link },
      props: { category: null, placeholderCategory: featured },
    }));
  return [...published, ...placeholders];
});

export const seriesRoute = localePaths(() =>
  getEnabledSeries().map((series) => ({ params: { seriesSlug: series.slug }, props: { series } })),
);

export const postListRoute = localePaths(async ({ locale, localeParams, paginate }) => {
  const posts = await getNonFeaturedPosts(locale);
  return paginate(posts, { pageSize: PAGINATION.pageSize, params: localeParams });
});
