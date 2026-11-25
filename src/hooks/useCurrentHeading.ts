/**
 * useCurrentHeading Hook
 *
 * Tracks the current article H2/H3 heading for the mobile post header. Thin
 * projection over the shared heading observer store.
 *
 * @example
 * ```tsx
 * const heading = useCurrentHeading({ offsetTop: 80 });
 * ```
 */

import type { ObservedHeading } from '@lib/toc';
import { useSyncExternalStore } from 'react';
import { getHeadingObserverStore } from './headingObserverStore';

/** Article H1–H3 (posts may use `#` for sections), excluding link preview cards */
const ARTICLE_SECTION_SELECTOR =
  'h1:not(.link-preview-block h1), h2:not(.link-preview-block h2), h3:not(.link-preview-block h3)';

export type CurrentHeading = ObservedHeading;

export interface UseCurrentHeadingOptions {
  /** Offset from top of viewport for detecting active heading (default: 80px) */
  offsetTop?: number;
}

/**
 * @param options - Options for heading detection
 * @returns Current heading info, or null when no heading has been scrolled past
 */
export function useCurrentHeading({ offsetTop = 80 }: UseCurrentHeadingOptions = {}): CurrentHeading | null {
  const store = getHeadingObserverStore({
    selector: ARTICLE_SECTION_SELECTOR,
    scopeSelector: 'article',
    offsetTop,
  });

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
