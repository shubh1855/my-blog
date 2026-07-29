# Style System (Tailwind + Design Tokens)

## Overview

astro-koharu uses **Tailwind CSS 4.x** as its styling framework, combined with a **design token system** to achieve consistent visual design.

### Style System Architecture

```plain
┌─────────────────────────────────────────────────────────────┐
│                   Style System Hierarchy                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Design Tokens (design-tokens.ts)                          │
│   ├── colors - Color system                                 │
│   ├── spacing - Spacing scale                               │
│   ├── shadows - Shadow system                               │
│   ├── borderRadius - Border radius                          │
│   └── animation - Animation configuration                   │
│              │                                              │
│              ▼                                              │
│   Tailwind Config (tailwind.config.mjs)                     │
│   ├── extend colors/shadows/etc                             │
│   ├── custom screens                                        │
│   └── plugins                                               │
│              │                                              │
│              ▼                                              │
│   CSS Variables (shadcn.css, theme/index.css)               │
│   ├── :root - Light mode variables                          │
│   └── .dark - Dark mode variables                           │
│              │                                              │
│              ▼                                              │
│   Component Styles                                          │
│   ├── Tailwind class names                                  │
│   └── cn() utility function                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Style File Organization

### `src/styles/index.css`

Entry file, importing all styles in order:

```css
/* Font definitions */
@import './theme/font.css';

/* Tailwind base */
@import './global/tailwind.css';

/* shadcn theme variables */
@import './global/shadcn.css';

/* Global animations */
@import './global/animate.css';

/* Component styles */
@import './components/wave.css';
@import './components/category.css';
@import './components/post.css';
@import './components/pagefind.css';

/* Theme styles */
@import './theme/index.css';
@import './theme/theme-transition.css';
@import './theme/markdown.css';
```

### Directory Structure

```plain
src/styles/
├── index.css              # Entry file
├── global/
│   ├── tailwind.css       # Tailwind directives
│   ├── shadcn.css         # shadcn theme variables
│   ├── animate.css        # Global animations
│   ├── reset.css          # CSS reset
│   └── utils.css          # Utility classes
├── theme/
│   ├── font.css           # Font definitions
│   ├── index.css          # Theme variables
│   ├── theme-transition.css # Theme toggle transitions
│   └── markdown.css       # Markdown styles
└── components/
    ├── wave.css           # Wave effect
    ├── category.css       # Category component
    ├── post.css           # Post component
    └── pagefind.css       # Search styles
```

---

## CSS Variables System

### shadcn Theme Variables

```css
/* src/styles/global/shadcn.css */

@layer base {
  :root {
    /* Background and foreground */
    --background: 0 0% 100%;
    --foreground: 0 0% 20%;

    /* Card */
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;

    /* Popover */
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;

    /* Primary color (Pink theme) */
    --primary: 351 77% 62%;
    --primary-foreground: 355.7 100% 97.3%;

    /* Secondary color */
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;

    /* Muted color */
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 0 0% 20% / 0.5;

    /* Accent color */
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;

    /* Destructive color */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;

    /* Border and input */
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 346.8 77.2% 49.8%;

    /* Radius */
    --radius: 0.5rem;
  }

  /* Dark mode */
  .dark {
    --background: 20 14.3% 4.1%;
    --foreground: 0 0% 95%;

    --card: 0 0% 13%;
    --card-foreground: 0 0% 95%;

    --popover: 0 0% 9%;
    --popover-foreground: 0 0% 95%;

    --primary: 350 77% 70%;
    --primary-foreground: 355.7 100% 97.3%;

    /* ... other dark variables */
  }
}
```

### Using CSS Variables

```css
/* Used inside component CSS */
.card {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border-radius: var(--radius);
}

/* Used inside Tailwind classes */
<div class="bg-card text-card-foreground rounded-lg" />
```

---

## Tailwind Configuration

### `tailwind.config.mjs`

```javascript
import {
  colors,
  shadows,
  borderRadius,
  animation as animationTokens,
} from './src/constants/design-tokens.ts';

export default {
  // Dark mode controlled via class
  darkMode: ['class'],

  theme: {
    // Responsive breakpoints (custom)
    screens: {
      xs: { max: '480px' },
      md: { max: '768px' },
      lg: { max: '1440px' },
      '2xl': '1440px',
      tablet: { max: '992px' },
      desktop: { min: '1480px' },
    },

    extend: {
      // Import colors from design tokens
      colors: {
        ...colors,
        // Gradient color variables
        'gradient-start': 'var(--gradient-bg-start)',
        'gradient-end': 'var(--gradient-bg-end)',
        // Custom colors
        logo: '#e91e63',
        mandy: {
          50: '#fef2f3',
          // ... full color palette
          950: '#470a1a',
        },
      },

      // Shadow system
      boxShadow: {
        ...shadows,
      },

      // Border radius
      borderRadius: {
        ...borderRadius,
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // Animations
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'slide-in-from-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.2s ease-in-out',
      },

      // Transition durations (from design tokens)
      transitionDuration: {
        fast: `${animationTokens.duration.fast}ms`,
        normal: `${animationTokens.duration.normal}ms`,
        slow: `${animationTokens.duration.slow}ms`,
      },

      // Easing functions
      transitionTimingFunction: {
        ...animationTokens.easing,
      },

      // Gradient backgrounds
      backgroundImage: {
        gradient: 'var(--gradient-bg)',
        'gradient-pink': 'var(--gradient-pink)',
        'gradient-header': 'var(--gradient-header)',
        'gradient-shoka-button': 'var(--gradient-shoka-button)',
      },

      // Fonts
      fontFamily: {
        sans: ['寒蝉全圆体', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'chill-round': ['寒蝉全圆体', 'sans-serif'],
      },

      // Custom spacing
      spacing: {
        7.5: '1.875rem',
        15: '3.75rem',
        17: '4.25rem',
      },
    },
  },

  // Plugins
  plugins: [
    require('@tailwindcss/container-queries'),  // Container queries
    require('tailwindcss-animate'),              // Animation utilities
    require('@tailwindcss/typography'),          // Typography
  ],
};
```

### Custom Breakpoints Explanation

```javascript
screens: {
  xs: { max: '480px' },      // Less than 480px
  md: { max: '768px' },      // Less than 768px
  lg: { max: '1440px' },     // Less than 1440px
  '2xl': '1440px',           // Greater than or equal to 1440px
  tablet: { max: '992px' },  // Tablet and below
  desktop: { min: '1480px' }, // Desktop
}

// Usage
<div class="hidden tablet:block" />  // Displayed on tablet and below
<div class="desktop:flex" />         // Displayed on desktop
```

---

## Design Tokens System

### Color System

```typescript
// src/constants/design-tokens.ts

export const colors = {
  // Semantic colors (using CSS variables)
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },

  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },

  // Theme color (Shoka pink)
  shoka: {
    DEFAULT: '#E95469',
    light: '#FF6B7A',
    dark: '#D63F55',
  },

  // Theme toggle icon colors
  themeToggle: {
    sun: '#ffbb52',
    moon: '#17181c',
  },

  // UI colors
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },

  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  border: 'hsl(var(--border))',
};
```

### Spacing Scale

```typescript
export const spacing = {
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  2: '0.5rem',      // 8px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  // ... more
};

// Naming shortcuts
export const spacingNames = {
  xs: spacing[2],   // 8px
  sm: spacing[3],   // 12px
  md: spacing[4],   // 16px
  lg: spacing[6],   // 24px
  xl: spacing[8],   // 32px
  '2xl': spacing[12], // 48px
};
```

### Shadow System

```typescript
export const shadows = {
  none: 'none',

  // Level 1: Subtle depth
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',

  // Level 2: Card level
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',

  // Level 3: Floating cards, dropdown menus
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',

  // Level 4: Modals, popovers
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',

  // Custom shadows
  card: '0 0.625rem 1.875rem rgba(90, 97, 105, 0.12)',
  'shoka-button': '0px 0px 16px 0px rgb(233, 84, 105, 0.8)',
};
```

### Z-Index Management

```typescript
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};
```

---

## `cn()` Utility Function

### Implementation

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Functionality

1. **`clsx`**: Handles conditional class names
2. **`twMerge`**: Intelligently merges Tailwind classes to resolve conflicts

### Usage Examples

```tsx
// Conditional class names
<button className={cn(
  'px-4 py-2 rounded',
  variant === 'primary' && 'bg-primary text-white',
  variant === 'outline' && 'border border-primary',
  disabled && 'opacity-50 cursor-not-allowed',
  className, // Allows external overrides
)} />

// Conflict resolution
cn('px-4', 'px-6')  // → 'px-6' (latter overrides)
cn('text-red-500', 'text-blue-500')  // → 'text-blue-500'
```

---

## Responsive Design

### Using Breakpoints

```html
<!-- Mobile-first -->
<div class="flex flex-col md:flex-row lg:grid lg:grid-cols-3">
  <!-- Mobile: Vertical layout -->
  <!-- Tablet: Horizontal layout -->
  <!-- Desktop: Three-column grid -->
</div>

<!-- Hide / Show -->
<nav class="hidden tablet:flex">
  <!-- Displayed on tablet and below -->
</nav>

<aside class="tablet:hidden">
  <!-- Hidden on tablet and below -->
</aside>
```

### Container Queries

```html
<!-- Using @container queries -->
<div class="@container">
  <div class="@md:flex @lg:grid @lg:grid-cols-2">
    <!-- Responds based on container width -->
  </div>
</div>
```

---

## Typography Styles

### Markdown Content

```css
/* src/styles/theme/markdown.css */

.prose {
  @apply text-foreground;

  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    @apply text-foreground font-bold;
  }

  /* Links */
  a {
    @apply text-primary hover:text-primary/80;
  }

  /* Code blocks */
  pre {
    @apply bg-muted rounded-lg overflow-x-auto;
  }

  code {
    @apply bg-muted px-1 py-0.5 rounded text-sm;
  }

  /* Blockquotes */
  blockquote {
    @apply border-l-4 border-primary pl-4 italic;
  }
}
```

### Typography Plugin

```html
<!-- Using prose class -->
<article class="prose dark:prose-invert">
  <!-- Markdown rendered content automatically gets typography styles -->
</article>
```

---

## Gradient Backgrounds

### CSS Variable Definitions

```css
:root {
  --gradient-bg-start: #ed719a;
  --gradient-bg-end: #ffffff;
  --gradient-bg: linear-gradient(180deg, var(--gradient-bg-start), var(--gradient-bg-end));

  --gradient-shoka-button: linear-gradient(135deg, #e9536a 0%, #f47c93 100%);
  --gradient-header: linear-gradient(180deg, rgba(0, 0, 0, 0.5), transparent);
}

.dark {
  --gradient-bg-start: #212832;
  --gradient-bg-end: #3f4659;
}
```

### Usage

```html
<div class="bg-gradient">
  <!-- Gradient background -->
</div>

<button class="bg-gradient-shoka-button">
  <!-- Theme gradient button -->
</button>
```

---

## Best Practices

### 1. Use Semantic Colors

```tsx
// ✅ Good: Use semantic variables
<div className="bg-background text-foreground" />
<div className="bg-card text-card-foreground" />
<button className="bg-primary text-primary-foreground" />

// ❌ Bad: Hardcoded colors
<div className="bg-white text-black dark:bg-gray-900 dark:text-white" />
```

### 2. Use Design Tokens

```tsx
// ✅ Good: Retrieve values from design tokens
import { animation } from '@constants/design-tokens';

<motion.div transition={animation.spring.default} />

// ❌ Bad: Hardcoded values
<motion.div transition={{ stiffness: 300, damping: 30 }} />
```

### 3. Use cn() to Merge Class Names

```tsx
// ✅ Good: Use cn() to handle conditions and overrides
<button className={cn('px-4 py-2', isActive && 'bg-primary', className)} />

// ❌ Bad: Manual string concatenation
<button className={`px-4 py-2 ${isActive ? 'bg-primary' : ''} ${className}`} />
```

### 4. Mobile-First

```tsx
// ✅ Good: Mobile-first, progressive enhancement
<div className="flex flex-col md:flex-row lg:grid" />

// ❌ Bad: Desktop-first, graceful degradation
<div className="grid lg:flex lg:flex-row md:flex-col" />
```

---

## Key Takeaways

1. **CSS Variables System**: `:root` and `.dark` define theme variables
2. **Design Tokens**: Unified management of colors, spacing, shadows, etc.
3. **Tailwind Config**: Extend default configurations, import design tokens
4. **cn() Function**: Intelligently merge Tailwind class names
5. **Responsive Design**: Custom breakpoints + container queries
6. **Typography**: Typography plugin + prose class

---

## Related Files

| File | Description |
|------|------|
| `src/styles/index.css` | Style entry point |
| `src/styles/global/shadcn.css` | Theme CSS variables |
| `src/styles/theme/index.css` | Custom theme variables |
| `src/styles/theme/markdown.css` | Markdown typography |
| `src/constants/design-tokens.ts` | Design tokens definitions |
| `tailwind.config.mjs` | Tailwind configuration |
| `src/lib/utils.ts` | `cn()` utility function |
