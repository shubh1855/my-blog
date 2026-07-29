/**
 * Custom Hooks Barrel Export
 *
 * Centralized export for all custom React hooks.
 * Import hooks from '@hooks' for convenience.
 */

export { useActiveHeading } from './useActiveHeading';
export { type UseExpandedStateOptions, type UseExpandedStateReturn, useExpandedState } from './useExpandedState';
export { type UseHeadingClickHandlerOptions, useHeadingClickHandler } from './useHeadingClickHandler';
export { findHeadingById, getParentIds, getSiblingIds, type Heading, useHeadingTree } from './useHeadingTree';

// Theme state hook (monitors actual page theme, not system preference)
export { useIsDarkTheme } from './useIsDarkTheme';

// Media query hooks
export { useMediaQuery, usePrefersReducedMotion } from './useMediaQuery';
