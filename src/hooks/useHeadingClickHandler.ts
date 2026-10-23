/**
 * useHeadingClickHandler Hook
 *
 * Scrolls to the clicked TOC heading and reveals it in the accordion.
 *
 * @example
 * ```tsx
 * const onHeadingClick = useHeadingClickHandler({ revealTo });
 * ```
 */

import { lockHeadingTo } from '@lib/heading-scroll-lock';
import { useCallback } from 'react';

export interface UseHeadingClickHandlerOptions {
  /** Accordion reveal action from `useExpandedState` */
  revealTo: (id: string) => void;
}

export function useHeadingClickHandler({ revealTo }: UseHeadingClickHandlerOptions): (id: string) => void {
  return useCallback(
    (id: string) => {
      const element = document.getElementById(id);
      if (!element) return;

      const hash = `#${encodeURIComponent(id)}`;
      if (window.location.hash !== hash) {
        window.history.pushState(window.history.state, '', hash);
      }

      // Pin the active heading until the programmatic scroll settles
      lockHeadingTo(id);
      const hadTabIndex = element.hasAttribute('tabindex');
      if (!hadTabIndex) {
        element.setAttribute('tabindex', '-1');
        element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
      }
      element.focus({ preventScroll: true });

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
      revealTo(id);
    },
    [revealTo],
  );
}
