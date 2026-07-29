/**
 * Design Tokens
 *
 * Single source of truth for all design values including colors, spacing, typography,
 * shadows, border radius, and animation timings.
 *
 * These tokens are mapped to Tailwind CSS configuration and CSS custom properties.
 */

/**
 * Color System
 *
 * Semantic color names mapped to CSS custom properties for theme support.
 * Colors automatically adapt to light/dark theme via CSS variables.
 */
export const colors = {
  // Primary brand colors
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },

  // Secondary colors
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },

  // Semantic colors
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))',
  },

  success: {
    DEFAULT: 'hsl(var(--success))',
    foreground: 'hsl(var(--success-foreground))',
  },

  warning: {
    DEFAULT: 'hsl(var(--warning))',
    foreground: 'hsl(var(--warning-foreground))',
  },

  // Shoka theme accent (replaces hardcoded #E95469)
  shoka: {
    DEFAULT: '#6a5acd',
    light: '#b858a8',
    dark: '#4a3da0',
  },

  // Theme toggle colors
  themeToggle: {
    sun: '#d4a020',
    moon: '#b858a8',
  },

  // UI colors
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },

  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))',
  },

  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },

  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },

  badge: {
    primary: {
      // WCAG
      DEFAULT: 'hsl(var(--badge-primary))',
    },
  },
  // Backgrounds and foregrounds
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',

  // Borders and inputs
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
} as const;

/**
 * Shadow System
 *
 * Box shadows for elevation levels (0-4).
 * Shadows are adjusted for light/dark themes.
 */
export const shadows = {
  none: 'none',

  // Elevation 1: Subtle depth
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',

  // Elevation 2: Card level
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',

  // Elevation 3: Elevated cards, dropdowns
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',

  // Elevation 4: Modals, popovers
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',

  // Inner shadow
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',

  // Custom shadows from project
  card: '0 0.625rem 1.875rem rgba(0, 0, 0, 0.2)',
  'card-darker': '0 0.625rem 1.875rem rgba(0, 0, 0, 0.35)',
  'shoka-button': '0px 0px 16px 0px rgba(106, 90, 205, 0.3)',
} as const;

/**
 * Border Radius Scale
 *
 * Consistent border radius values for corners.
 */
export const borderRadius = {
  none: '0',
  sm: '0',
  DEFAULT: '0',
  md: '0',
  lg: '0',
  xl: '0',
  '2xl': '0',
  '3xl': '0',
  full: '9999px',
} as const;

/**
 * Animation Timings
 *
 * Duration and easing functions for consistent motion.
 */
export const animation = {
  // Duration in milliseconds
  duration: {
    fast: 150,
    tween: 200, // Between fast and normal
    normal: 250,
    ui: 300, // Common UI interaction
    slow: 350,
    slower: 500,
    flipCard: 600, // Card flip animation
  },

  // Easing functions
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Spring-like easing
  },

  // Spring configurations for Motion library
  spring: {
    // Default spring (balanced)
    default: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    },

    // Gentle spring (smooth)
    gentle: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 25,
    },

    // Wobbly spring (bouncy)
    wobbly: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 20,
    },

    // Stiff spring (snappy)
    stiff: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 35,
    },

    // Slow spring (relaxed)
    slow: {
      type: 'spring' as const,
      stiffness: 150,
      damping: 20,
    },

    // Micro animations (existing in project)
    microDamping: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 13,
    },

    microRebound: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 9,
    },

    // Component-specific springs
    menu: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
    },

    popoverContent: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
    },
  },

  // Transition objects for CSS transitions
  transition: {
    fast: `all ${150}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    normal: `all ${250}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    slow: `all ${350}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  },
} as const;

/**
 * Z-Index Scale
 *
 * Consistent layering for stacking contexts.
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;
