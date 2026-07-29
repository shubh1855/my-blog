# Component Patterns and Best Practices

## Component Type Selection

In astro-koharu, components are divided into two main categories: **Astro components** and **React components**. Choosing which type to use depends on the functional requirements of the component.

### Selection Guide

```plain
┌─────────────────────────────────────────────────────────────┐
│             Needs interactivity/state management?           │
└─────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
       No                      Yes
        │                       │
        ▼                       ▼
┌───────────────────┐   ┌───────────────────┐
│   Astro Component │   │   React Component │
│   (.astro)        │   │   (.tsx)          │
│                   │   │                   │
│ - Static content  │   │ - Interactive     │
│ - Layout          │   │ - State mgmt      │
│ - SEO metadata    │   │ - Animation       │
│ - Server data     │   │ - Real-time update│
└───────────────────┘   └───────────────────┘
```

### Practical Comparison

| Scenario | Component Type | Example |
|------|---------|------|
| Page layout | Astro | `Layout.astro` |
| Post list (static) | Astro | `PostList.astro` |
| Navigation menu | Astro + React | `Navigator.astro` + `DropdownNav.tsx` |
| Theme toggle | Astro (inline script) | `ThemeToggle.astro` |
| Search dialog | React | `SearchDialog.tsx` |
| Sidebar TOC | React | `TableOfContents.tsx` |
| Paginator | Astro | `Paginator.astro` |

---

## Client Directives Detailed

When a React component needs to be used in an Astro page, a `client:*` directive must be added to activate JavaScript.

### Directive Types

```astro
<!-- Hydrate immediately on page load -->
<ThemeToggle client:load />

<!-- Hydrate once browser is idle -->
<MenuIcon client:idle />

<!-- Hydrate once component is visible in viewport -->
<SearchDialog client:visible />

<!-- Hydrate when media query matches -->
<MobileNav client:media="(max-width: 768px)" />

<!-- Client-only render (skips SSR) -->
<ClientOnlyComponent client:only="react" />
```

### Selection Strategy

```typescript
// 1. Critical interaction - Use client:load
// Features users need to use immediately
<ThemeToggle client:load />
<Navigator client:load />

// 2. Non-critical features - Use client:idle
// Features that can be lazily loaded
<MenuIcon client:idle />

// 3. Off-screen content - Use client:visible
// Content visible only after scrolling
<Comments client:visible />
<FooterLinks client:visible />

// 4. Dependent on browser APIs - Use client:only
// Components that cannot be rendered on the server
<WindowSizeDisplay client:only="react" />
```

### Application in Project

```astro
<!-- src/components/layout/Header.astro -->
---
import { MenuIcon } from '@components/ui/MenuIcon';
import Navigator from './Navigator.astro';
---

<!-- Static navbar -->
<Navigator transition:name="page-header" />

<!-- Mobile menu button - Needs interaction -->
<MenuIcon
  client:load
  className="tablet:flex fixed top-0 left-3 z-52 hidden"
  id="mobile-menu-container"
/>
```

---

## Component Communication Patterns

### 1. Props Passing (Parent → Child)

The simplest communication method, suitable for simple data passing:

```astro
<!-- Parent Component: PostPage.astro -->
---
const post = await getPost(slug);
---
<PostContent post={post} />
<SeriesNavigation client:load post={post} />

<!-- Child Component: SeriesNavigation.tsx -->
interface SeriesNavigationProps {
  post: BlogPost;
}

const SeriesNavigation = ({ post }: SeriesNavigationProps) => {
  // Use post data
};
```

### 2. Nanostores (Global State)

Cross Astro/React boundary state sharing:

```typescript
// src/store/ui.ts
import { atom } from 'nanostores';

export const drawerOpen = atom<boolean>(false);

export function toggleDrawer(): void {
  drawerOpen.set(!drawerOpen.get());
}
```

```tsx
// Used in React Component
import { useStore } from '@nanostores/react';
import { drawerOpen, toggleDrawer } from '@store/ui';

const MenuIcon = () => {
  const isOpen = useStore(drawerOpen);

  return (
    <button onClick={toggleDrawer}>
      {isOpen ? 'Close' : 'Open'}
    </button>
  );
};
```

```astro
<!-- Listen in Astro Component -->
<script>
  import { drawerOpen } from '@store/ui';

  drawerOpen.subscribe((isOpen) => {
    document.body.classList.toggle('drawer-open', isOpen);
  });
</script>
```

### 3. Custom Web Components

Used for complex internal state management inside Astro components:

```astro
<!-- src/components/layout/HomeSider.astro -->
<script>
  // Define Web Component
  class SiderContent extends HTMLElement {
    private infoContent: HTMLElement | null = null;
    private directoryContent: HTMLElement | null = null;

    connectedCallback() {
      this.infoContent = this.querySelector('[data-slot="info"]');
      this.directoryContent = this.querySelector('[data-slot="directory"]');
    }

    updateSlot(type: string) {
      this.infoContent?.classList.toggle('hidden', type !== 'INFO');
      this.directoryContent?.classList.toggle('hidden', type !== 'DIRECTORY');
    }
  }

  customElements.define('sider-content', SiderContent);
</script>

<sider-content>
  <div data-slot="info">...</div>
  <div data-slot="directory">...</div>
</sider-content>
```

---

## Error Boundary Design

### Basic Error Boundary

Used to catch JavaScript errors in the component tree:

```tsx
// src/components/common/ErrorBoundary.tsx
'use client';

import { ErrorBoundary as ErrorBoundaryLib } from 'react-error-boundary';
import { Button } from '../ui/button';

const FallbackComponent = () => {
  return (
    <div className="flex-center-y w-full gap-2 py-6">
      Oops, Something wrong! Please contact to{' '}
      <a href="mailto:i@cosine.ren" className="text-blue-500">
        i@cosine.ren
      </a>
      or
      <Button onClick={() => window.location.reload()}>
        Reload Page
      </Button>
    </div>
  );
};

export const ErrorBoundary: FC<PropsWithChildren> = ({ children }) => {
  return (
    <ErrorBoundaryLib
      FallbackComponent={FallbackComponent}
      onError={(e) => console.error(e)}
    >
      {children}
    </ErrorBoundaryLib>
  );
};
```

### Floating UI Dedicated Error Boundary

Error handling specifically tailored for floating components like Popover, Tooltip:

```tsx
// src/components/common/FloatingErrorBoundary.tsx

/**
 * Error boundary for floating components
 * Features: Silent fallback on error (renders null), without affecting main content
 */
class FloatingErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Print error in dev environment
    if (process.env.NODE_ENV !== 'production') {
      console.error('FloatingErrorBoundary caught:', error, errorInfo);
    }
    // Can report to Sentry in prod environment
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Floating component failure → silently return null
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

/**
 * HOC: Quickly wrap components
 */
export function withFloatingErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string,
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <FloatingErrorBoundary componentName={componentName}>
      <Component {...props} />
    </FloatingErrorBoundary>
  );

  WrappedComponent.displayName =
    `withFloatingErrorBoundary(${componentName || Component.name})`;

  return WrappedComponent;
}
```

### Usage Example

```tsx
// src/components/layout/DropdownNav.tsx

import { withFloatingErrorBoundary } from '@components/common/FloatingErrorBoundary';

const DropdownNavComponent = ({ item }: DropdownNavProps) => {
  // Component implementation...
};

// 1. Performance optimization: memo prevents unnecessary re-renders
const DropdownNav = memo(DropdownNavComponent);

// 2. Error isolation: HOC wrapper
const DropdownNavWithErrorBoundary = withFloatingErrorBoundary(
  DropdownNav,
  'DropdownNav'
);

export default DropdownNavWithErrorBoundary;
```

---

## Performance Optimization Techniques

### 1. React.memo

Prevent unnecessary re-renders:

```tsx
// Before optimization
const DropdownNav = ({ item }: DropdownNavProps) => {
  // ...
};

// After optimization
const DropdownNavComponent = ({ item }: DropdownNavProps) => {
  // ...
};

const DropdownNav = memo(DropdownNavComponent);
```

### 2. useCallback

Stable function references:

```tsx
// Before optimization: creates new function every render
const handleClick = () => {
  setIsOpen(!isOpen);
};

// After optimization: stable function reference
const handleClick = useCallback(() => {
  setIsOpen((prev) => !prev);
}, []);
```

### 3. Lazy Loading Directives

```astro
<!-- Off-screen component lazy loading -->
<Comments client:visible />

<!-- Load non-critical components when idle -->
<Analytics client:idle />
```

### 4. Conditional Rendering Optimization

```astro
---
// Server-side conditional rendering - produces no extra JS
const showSidebar = post.data.catalog;
---

{showSidebar && <TableOfContents client:visible headings={headings} />}
```

---

## Complete Component Example

### DropdownNav Component Analysis

```tsx
// src/components/layout/DropdownNav.tsx

import { memo } from 'react';
import Popover from '@components/ui/popover';
import { type Router } from '@constants/router';
import { useToggle } from '@hooks/useToggle';
import { Icon } from '@iconify/react';
import { cn } from '@lib/utils';
import { withFloatingErrorBoundary } from '@components/common/FloatingErrorBoundary';

interface DropdownNavProps {
  item: Router;
  className?: string;
}

const DropdownNavComponent = ({ item, className }: DropdownNavProps) => {
  // 1. Use custom Hook to manage open/close state
  const { isOpen, setIsOpen } = useToggle({ defaultOpen: false });
  const { name, icon, children } = item;

  return (
    // 2. Use Popover component to achieve dropdown effect
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-start"
      trigger="hover"
      render={() => (
        // 3. Dropdown menu content
        <div className="nav-dropdown flex flex-col items-center">
          {children?.map((child: Router, index) => (
            <a
              key={child.path}
              href={child.path}
              className={cn(
                'hover:bg-gradient-shoka-button px-4 py-2 transition-colors',
                {
                  // 4. Dynamic rounded corners
                  'rounded-ss-2xl': index === 0,
                  'rounded-ee-2xl': index === children.length - 1,
                  // 5. Current route highlight
                  'bg-gradient-shoka-button': window.location.pathname === child.path,
                },
              )}
            >
              {child.icon && <Icon icon={child.icon} />}
              {child.name}
            </a>
          ))}
        </div>
      )}
    >
      {/* 6. Trigger button */}
      <button
        className={cn('inline-flex items-center px-4 py-2', className)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${name} Menu`}
      >
        {icon && <Icon icon={icon} />}
        {name}
        {/* 7. Arrow rotation animation */}
        <Icon
          icon="ri:arrow-drop-down-fill"
          className={cn('transition-transform', {
            'rotate-180': isOpen,
          })}
        />
      </button>
    </Popover>
  );
};

// 8. Performance optimization: memo
const DropdownNav = memo(DropdownNavComponent);

// 9. Error isolation: HOC
const DropdownNavWithErrorBoundary = withFloatingErrorBoundary(
  DropdownNav,
  'DropdownNav'
);

export default DropdownNavWithErrorBoundary;
```

### Key Design Points

1. **State Management**: Using `useToggle` custom Hook
2. **Compound Component**: Popover + Trigger + Content
3. **Style Composition**: `cn()` function combining Tailwind classes
4. **Accessibility**: ARIA attribute support
5. **Animation**: CSS transition implementing arrow rotation
6. **Performance**: memo prevents re-rendering
7. **Error Handling**: HOC wrapper for error boundary

---

## Component Directory Structure

```plain
src/components/
├── common/              # Common utility components
│   ├── ErrorBoundary.tsx
│   └── FloatingErrorBoundary.tsx
│
├── layout/              # Layout components
│   ├── Header.astro         # Static header
│   ├── Navigator.astro      # Navigation container
│   ├── DropdownNav.tsx      # Dropdown navigation (interactive)
│   ├── HomeSider.astro      # Sidebar
│   └── MobileDrawer.astro   # Mobile drawer
│
├── ui/                  # Base UI components
│   ├── button.tsx
│   ├── popover.tsx
│   ├── card.tsx
│   └── ...
│
├── post/                # Post related
│   ├── PostList.astro       # Static list
│   ├── PostItemCard.astro   # Static card
│   └── SeriesNavigation.tsx # Series navigation (interactive)
│
└── theme/               # Theme components
    └── ThemeToggle.astro
```

---

## Key Takeaways

1. **Component Type Selection**:
   - Static content → Astro component
   - Interactive functionality → React component
2. **Client Directives**:
   - `client:load` - Critical interaction
   - `client:idle` - Non-critical functionality
   - `client:visible` - Lazy loading
3. **Communication Patterns**:
   - Props - Simple data passing
   - Nanostores - Cross-component state
   - Web Components - Complex internal Astro state
4. **Error Handling**:
   - ErrorBoundary - General error catching
   - FloatingErrorBoundary - Floating UI silent fallback
5. **Performance Optimization**:
   - `memo()` - Prevents re-rendering
   - `useCallback()` - Stable function reference
   - Client Directives - Controls JS loading timing

---

## Related Files

| File | Description |
|------|-------------|
| `src/components/common/ErrorBoundary.tsx` | General Error Boundary |
| `src/components/common/FloatingErrorBoundary.tsx` | Floating UI Error Boundary |
| `src/components/layout/Header.astro` | Page Header Component |
| `src/components/layout/DropdownNav.tsx` | Dropdown Navigation |
| `src/components/layout/Navigator.astro` | Navigation Container |
| `src/store/ui.ts` | UI State Management |
| `src/hooks/useToggle.ts` | Toggle State Hook |
