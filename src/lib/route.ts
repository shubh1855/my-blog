import { Routes } from '@constants/router';
import type { PostRef } from 'types/blog';

/**
 * Client-safe: this module is bundled into React islands, so it must not import
 * content/locale helpers (they pull in the `transliteration` library, ~54 KB gz).
 * Server code with a full BlogPost resolves `getPostSlug(post)` first and passes a PostRef.
 */
export type RouteParams<T extends Routes> = T extends Routes.Post ? PostRef | undefined : undefined;

/**
 * Encode a slug, preserving `/` but escaping other URL-unsafe characters (matches Hexo behavior).
 */
export const encodeSlug = (slug: string) => slug?.split('/').map(encodeURIComponent).join('/') ?? '';

export function routeBuilder<T extends Routes>(route: T, param: RouteParams<typeof route>) {
  let href: string = route;
  if (!param) return href;
  switch (route) {
    case Routes.Post: {
      // link (raw frontmatter override) takes precedence over slug (transliterated by transforms)
      const slug = param.link ?? param.slug;
      href += `/${encodeSlug(slug)}`;
      break;
    }
    default:
      break;
  }
  return href;
}
