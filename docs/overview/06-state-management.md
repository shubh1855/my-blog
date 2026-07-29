# State Management (Nanostores)

## Why Nanostores?

astro-koharu uses **Nanostores** for global state management instead of more popular choices like Redux or Zustand. Here is why:

| Feature | Nanostores | Redux | Zustand |
|------|-----------|-------|---------|
| Size | ~1KB | ~7KB | ~3KB |
| Framework-agnostic | Yes | No | No |
| Astro Support | Native | Needs adapter | Needs adapter |
| Learning Curve | Very low | High | Medium |
| Boilerplate Code | Almost none | Heavy | Light |

### Core Advantages

1. **Extremely Lightweight**: Less than 1KB gzipped.
2. **Framework-agnostic**: Works seamlessly in both Astro and React.
3. **Simple API**: Just `atom` and `useStore`.
4. **No Provider Needed**: No wrapping of root components required.
5. **TypeScript Friendly**: Full type inference.

---

## Basic Concepts

### Atom (Atomic State)

Atom is the most basic state unit, storing a single value:

```typescript
import { atom } from 'nanostores';

// Create an atom
const count = atom<number>(0);

// Read value
console.log(count.get());  // 0

// Set value
count.set(1);

// Subscribe to changes
const unsubscribe = count.subscribe((value) => {
  console.log('New value:', value);
});

// Unsubscribe
unsubscribe();
```

### Usage in React

```tsx
import { useStore } from '@nanostores/react';
import { count } from './store';

function Counter() {
  // useStore triggers re-render when atom changes
  const value = useStore(count);

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => count.set(value + 1)}>+1</button>
    </div>
  );
}
```

---

## Project State Architecture

```plain
src/store/
├── app.ts      # Application state (sidebar types, etc.)
└── ui.ts       # UI state (drawers, menus, search, etc.)
```

### Architecture Diagram

```plain
┌─────────────────────────────────────────────────────────────┐
│                    Nanostores State Layer                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   app.ts                         ui.ts                      │
│   ┌─────────────────────┐       ┌─────────────────────┐    │
│   │ homeSiderSegmentType│       │ drawerOpen          │    │
│   │ homeSiderType       │       │ mobileMenuOpen      │    │
│   └─────────────────────┘       │ modalOpen           │    │
│                                 │ searchOpen          │    │
│                                 │                     │    │
│                                 │ toggleDrawer()      │    │
│                                 │ openDrawer()        │    │
│                                 │ closeDrawer()       │    │
│                                 └─────────────────────┘    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   React Components              Astro Components            │
│   ┌─────────────────────┐       ┌─────────────────────┐    │
│   │ MenuIcon.tsx        │       │ HomeSider.astro     │    │
│   │ DropdownNav.tsx     │       │ MobileDrawer.astro  │    │
│   │ SearchDialog.tsx    │       │ FloatingGroup.astro │    │
│   └─────────────────────┘       └─────────────────────┘    │
│          │                              │                   │
│          │  useStore()                  │  subscribe()      │
│          └──────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## UI State Details

### `src/store/ui.ts`

```typescript
/**
 * Global UI State Management
 *
 * Global state based on Nanostores, used for UI components needing cross Astro/React boundary communication.
 * Replaces the previous CustomEvent pattern, providing better type safety and reactivity.
 */

import { atom } from 'nanostores';

/**
 * Mobile drawer state
 * Controls sidebar visibility
 * Used by MenuIcon, HomeSider, FloatingGroup
 */
export const drawerOpen = atom<boolean>(false);

/**
 * Mobile menu state
 * Controls responsive navigation menu visibility
 */
export const mobileMenuOpen = atom<boolean>(false);

/**
 * Modal state
 * Generic modal state reserved for future use
 */
export const modalOpen = atom<boolean>(false);

/**
 * Search modal state
 * Controls search dialog visibility
 */
export const searchOpen = atom<boolean>(false);

/**
 * Helper function - Toggle drawer state
 */
export function toggleDrawer(): void {
  drawerOpen.set(!drawerOpen.get());
}

/**
 * Helper function - Open drawer
 */
export function openDrawer(): void {
  drawerOpen.set(true);
}

/**
 * Helper function - Close drawer
 */
export function closeDrawer(): void {
  drawerOpen.set(false);
}

/**
 * Helper function - Toggle mobile menu
 */
export function toggleMobileMenu(): void {
  mobileMenuOpen.set(!mobileMenuOpen.get());
}

/**
 * Helper function - Toggle modal
 */
export function toggleModal(): void {
  modalOpen.set(!modalOpen.get());
}

/**
 * Helper function - Toggle search
 */
export function toggleSearch(): void {
  searchOpen.set(!searchOpen.get());
}
```

### State Details

| State | Type | Purpose |
|------|------|------|
| `drawerOpen` | `boolean` | Mobile sidebar drawer |
| `mobileMenuOpen` | `boolean` | Mobile navigation menu |
| `modalOpen` | `boolean` | Generic modal |
| `searchOpen` | `boolean` | Search dialog |

---

## Application State Details

### `src/store/app.ts`

```typescript
import { HomeSiderSegmentType, HomeSiderType } from '@constants/enum';
import { atom } from 'nanostores';

/**
 * Sidebar segment type
 * Controls content type displayed in sidebar (info/directory/series)
 */
export const homeSiderSegmentType = atom<HomeSiderSegmentType>(
  HomeSiderSegmentType.INFO
);

/**
 * Sidebar type
 * Controls overall sidebar mode (home/post/none)
 */
export const homeSiderType = atom<HomeSiderType>(HomeSiderType.HOME);
```

### Enum Definitions

```typescript
// src/constants/enum.ts

export enum HomeSiderSegmentType {
  INFO = 'INFO',           // Info panel
  DIRECTORY = 'DIRECTORY', // Directory TOC navigation
  SERIES = 'SERIES',       // Series posts
}

export enum HomeSiderType {
  HOME = 'HOME',  // Home page mode
  POST = 'POST',  // Post page mode
  NONE = 'NONE',  // No sidebar
}
```

---

## Usage in React Components

### MenuIcon Component Example

```tsx
// src/components/ui/MenuIcon.tsx
'use client';

import { useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { useStore } from '@nanostores/react';
import { drawerOpen, toggleDrawer } from '@store/ui';

const MenuIcon = ({ className, id }: MenuIconProps) => {
  // 1. Subscribe to state
  const isOpen = useStore(drawerOpen);
  const controls = useAnimation();

  // 2. Trigger animation on state change
  useEffect(() => {
    controls.start(isOpen ? 'opened' : 'closed');
  }, [isOpen, controls]);

  // 3. Toggle state on click
  const handleToggle = () => {
    toggleDrawer();
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      <svg>
        <motion.g variants={lineVariants} animate={controls} custom={1}>
          <line x1="3" y1="6" x2="21" y2="6" />
        </motion.g>
        {/* More lines... */}
      </svg>
    </button>
  );
};
```

### Key Points

1. **`useStore`**: Automatically subscribes to atom changes, re-rendering component when state updates.
2. **`toggleDrawer()`**: Uses helper functions instead of calling `set` directly.
3. **Two-way binding**: UI reflects state; clicks change state.

---

## Usage in Astro Components

### Using `<script>` Tags

```astro
<!-- src/components/layout/MobileDrawer.astro -->
<div id="mobile-drawer" class="hidden">
  <!-- Drawer content -->
</div>

<script>
  import { drawerOpen } from '@store/ui';

  // Subscribe to state changes
  drawerOpen.subscribe((isOpen) => {
    const drawer = document.getElementById('mobile-drawer');
    if (drawer) {
      drawer.classList.toggle('hidden', !isOpen);
    }
  });
</script>
```

### Using React Islands

```astro
<!-- src/components/layout/HomeSider.astro -->
---
import { HomeSiderSegmented } from './HomeSiderSegmented';
---

<div class="sider-container">
  <!-- React component handles interaction -->
  <HomeSiderSegmented
    client:load
    defaultValue={defaultSegmentType}
  />

  <!-- Static content -->
  <div class="sider-content">
    <slot />
  </div>
</div>
```

---

## State Communication Flow

### Scenario: Click Menu Icon to Open Drawer

```plain
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks MenuIcon                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. toggleDrawer() is called                                │
│     drawerOpen.set(!drawerOpen.get())                       │
│     drawerOpen: false → true                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. All subscribers receive notification                     │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ MenuIcon.tsx    │  │ MobileDrawer    │                  │
│  │ useStore()      │  │ subscribe()     │                  │
│  │ triggers        │  │ triggers DOM    │                  │
│  │ re-render       │  │ update          │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI Updates                                              │
│  - MenuIcon animates into X shape                           │
│  - MobileDrawer slides into view                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### 1. State Granularity

Each atom stores only a single concern:

```typescript
// ✅ Good: Fine-grained state
export const drawerOpen = atom<boolean>(false);
export const searchOpen = atom<boolean>(false);

// ❌ Bad: Coarse-grained state
export const uiState = atom({
  drawerOpen: false,
  searchOpen: false,
  // More...
});
```

### 2. Helper Functions

Provide helper functions for common operations:

```typescript
// ✅ Good: Provide semantic functions
export function toggleDrawer(): void {
  drawerOpen.set(!drawerOpen.get());
}

// Usage
toggleDrawer();

// ❌ Bad: Direct manipulation
drawerOpen.set(!drawerOpen.get());
```

### 3. Type Safety

Leverage TypeScript generics to ensure type safety:

```typescript
// Atom with generic type
export const homeSiderType = atom<HomeSiderType>(HomeSiderType.HOME);

// Type checking
homeSiderType.set(HomeSiderType.POST);  // ✅
homeSiderType.set('invalid');           // ❌ Type error
```

### 4. Component Decoupling

Separate state logic from component logic:

```typescript
// store/ui.ts - State definition
export const drawerOpen = atom<boolean>(false);
export function toggleDrawer(): void { /* ... */ }

// MenuIcon.tsx - Only cares about UI
const MenuIcon = () => {
  const isOpen = useStore(drawerOpen);
  return <button onClick={toggleDrawer}>...</button>;
};
```

---

## Comparison with Previous Approaches

### CustomEvent Pattern (Old)

```javascript
// Dispatch event
window.dispatchEvent(new CustomEvent('drawer-toggle', { detail: true }));

// Listen for event
window.addEventListener('drawer-toggle', (e) => {
  const isOpen = e.detail;
  // Update UI
});
```

**Issues**:
- No type safety
- Difficult to trace state
- Prone to memory leaks

### Nanostores Pattern (New)

```typescript
// Update state
drawerOpen.set(true);

// Subscribe to state
const unsubscribe = drawerOpen.subscribe((isOpen) => {
  // Update UI
});
```

**Advantages**:
- Full type inference
- Traceable state
- Automatic subscription cleanup

---

## Key Takeaways

1. **Nanostores Basics**: `atom` creates state, `useStore` subscribes to state.
2. **Cross-Framework Communication**: Use `useStore` in React, `subscribe` in Astro.
3. **State Granularity**: Each atom stores a single value.
4. **Helper Functions**: Encapsulate common operations for better readability.
5. **Type Safety**: Leverage generics to ensure correct state types.
6. **Alternatives**: Safer and easier to maintain than CustomEvents.

---

## Related Files

| File | Description |
|------|-------------|
| `src/store/app.ts` | Application State |
| `src/store/ui.ts` | UI State |
| `src/constants/enum.ts` | State Enums |
| `src/components/ui/MenuIcon.tsx` | Component Example using State |
| `src/components/layout/MobileDrawer.astro` | Using State in Astro |
