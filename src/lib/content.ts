/**
 * Content utilities - Index file
 *
 * Re-exports all content-related utilities from modular files.
 * This maintains backward compatibility while organizing code better.
 */

// =============================================================================
// Category Utilities
// =============================================================================
export {
  buildCategoryPath,
  getCategoryArr,
  getCategoryByLink,
  getCategoryLinks,
  getCategoryList,
  getParentCategory,
  translateCategoryName,
  translateSeriesField,
} from './content/categories';

// =============================================================================
// Locale Utilities
// =============================================================================
export { getPostLocale, getPostSlug } from './content/locale';
// =============================================================================
// Post Utilities
// =============================================================================
export {
  // Core post functions

  // Featured series functions
  getEnabledSeries,
  getHomePagePosts,
  getNonFeaturedPosts,
  getPostById,
  getPostCount,
  getPostDescription,
  getPostLastCategory,
  // Reading time utility

  getPostSummary,
  getPostsByCategory,
  getSortedPosts,
} from './content/posts';

// =============================================================================
// Tag Utilities
// =============================================================================
export { buildTagPath, getAllTags, normalizeTag } from './content/tags';

// =============================================================================
// Types
// =============================================================================
export type { Category, CategoryListResult } from './content/types';
