/**
 * Custom Hooks Barrel Export
 *
 * Centralized export for all custom React hooks.
 * Import hooks from '@hooks' for convenience.
 */

// Controlled/uncontrolled state pattern
export type { UseControlledStateOptions } from './useControlledState';
// Clipboard with feedback

export type { CurrentHeading, UseCurrentHeadingOptions } from './useCurrentHeading';
// Floating UI wrapper
export type { UseFloatingUIOptions } from './useFloatingUI';
// TOC hooks (useTocController etc.) are imported via direct paths; see src/hooks/useTocController.ts
// Theme state hook (monitors actual page theme, not system preference)
export { useIsDarkTheme } from './useIsDarkTheme';
// Utility hooks

// Keyboard shortcuts
export type { KeyboardShortcutOptions, ModifierKey } from './useKeyboardShortcut';
// Media query hooks
export { useMediaQuery } from './useMediaQuery';
// Timer management

// Scroll state hooks
export type { ScrollTriggerState, UseScrollTriggerOptions } from './useScrollTrigger';
// Zoom and pan for fullscreen viewers
export type { UseZoomPanReturn } from './useZoomPan';
