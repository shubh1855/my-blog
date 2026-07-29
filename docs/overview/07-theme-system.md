# Theme System Implementation

## Overview

astro-koharu implements complete dark/light theme switching functionality, including:

1. **FOUC Prevention**: Prevents theme flickering during page load
2. **localStorage Persistence**: Remembers user preferences
3. **System Theme Sync**: Defaults to following system settings
4. **View Transitions Animation**: Circular expansion animation for theme toggling
5. **Astro Page Transition Compatibility**: Ensures theme persists across page navigation

---

## Theme Switching Principle

### Overall Workflow

```plain
┌─────────────────────────────────────────────────────────────┐
│                   Theme System Workflow                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Page Load (HTML parsing phase)                          │
│     - Inline script executes immediately                    │
│     - Checks localStorage.theme                             │
│     - Checks prefers-color-scheme                           │
│     - Sets <html class="dark/light">                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Page Render                                             │
│     - CSS variables take effect based on .dark/.light class │
│     - ThemeToggle component initializes                     │
│     - Checkbox state syncs                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. User Toggles Theme                                      │
│     - Checkbox state changes                                │
│     - View Transitions API triggers                         │
│     - Circular expansion animation                          │
│     - localStorage updates                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Astro Page Transition                                   │
│     - astro:page-load event                                 │
│     - Re-checks theme                                       │
│     - Re-binds events                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## FOUC Prevention

### What is FOUC?

**FOUC** (Flash of Unstyled Content) refers to the phenomenon where, during page load, the page briefly displays the wrong theme because the theme state has not been applied in time.

### Solution: Inline Script

Use an `is:inline` script in the `<head>` of `Layout.astro`:

```astro
<!-- src/layouts/Layout.astro -->
<head>
  <!-- Executes immediately, completes before DOM renders -->
  <script is:inline>
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
       window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  </script>
</head>
```

### Why use `is:inline`?

| Feature | Regular Script | `is:inline` Script |
|------|---------|-----------------|
| Execution Timing | Deferred execution | Immediate execution |
| Bundling | Bundled | Kept as-is |
| Render Blocking | No | Yes (briefly) |
| Applicable Scenarios | Feature scripts | Critical initialization |

---

## ThemeToggle Component

### Complete Implementation

```astro
<!-- src/components/theme/ThemeToggle.astro -->

<!-- Toggle button UI -->
<div
  class="theme-toggle scale-80 cursor-pointer transition duration-300 hover:scale-90"
  id="theme-toggle-btn"
  role="button"
  tabindex="0"
  aria-label="toggle theme"
>
  <label class="toggle" aria-label="toggle theme">
    <input type="checkbox" id="theme-checkbox" />
    <div></div>
  </label>
</div>

<script>
  function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const checkbox = document.getElementById('theme-checkbox') as HTMLInputElement | null;
    if (!toggleBtn || !checkbox) return;

    // Prevent duplicate event binding (re-executes during Astro page transitions)
    if (toggleBtn.dataset.listenerAttached === 'true') return;

    const rootElement = document.documentElement;

    // Sync checkbox state with current theme
    const isDarkMode = rootElement.classList.contains('dark');
    checkbox.checked = isDarkMode;

    function toggleTheme() {
      if (!checkbox) return;
      const isDark = checkbox.checked;

      // Get button position as animation origin point
      const toggleElement = document.querySelector('.theme-toggle');
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;

      if (toggleElement) {
        const rect = toggleElement.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }

      // Add theme transition class
      rootElement.classList.add('theme-transition');

      // Check if browser supports View Transitions API
      if (!document.startViewTransition) {
        // Fallback processing
        applyTheme(isDark);
        setTimeout(() => {
          rootElement.classList.remove('theme-transition');
        }, 100);
        return;
      }

      // Use View Transitions API
      const transition = document.startViewTransition(() => {
        applyTheme(isDark);
      });

      // Set animation origin point
      transition.ready
        .then(() => {
          rootElement.style.setProperty('--x', `${x}px`);
          rootElement.style.setProperty('--y', `${y}px`);
        })
        .catch(console.error);

      // Cleanup
      transition.finished
        .then(() => rootElement.classList.remove('theme-transition'))
        .catch(() => rootElement.classList.remove('theme-transition'));
    }

    function applyTheme(isDark: boolean): void {
      if (isDark) {
        rootElement.classList.add('dark');
        rootElement.classList.remove('light');
        localStorage.setItem('theme', 'dark');
      } else {
        rootElement.classList.remove('dark');
        rootElement.classList.add('light');
        localStorage.setItem('theme', 'light');
      }
    }

    checkbox.addEventListener('change', toggleTheme);
    toggleBtn.dataset.listenerAttached = 'true';
  }

  // Initial load
  setupThemeToggle();

  // Re-setup after Astro page transition
  document.addEventListener('astro:page-load', setupThemeToggle);
</script>
```

### Key Code Analysis

#### 1. Prevent Duplicate Binding

```javascript
if (toggleBtn.dataset.listenerAttached === 'true') return;
// ...
toggleBtn.dataset.listenerAttached = 'true';
```

Astro page transitions re-execute scripts, requiring duplicate event binding prevention.

#### 2. View Transitions API

```javascript
const transition = document.startViewTransition(() => {
  applyTheme(isDark);
});

transition.ready.then(() => {
  rootElement.style.setProperty('--x', `${x}px`);
  rootElement.style.setProperty('--y', `${y}px`);
});
```

View Transitions API allows creating smooth transition animations when the DOM changes.

#### 3. Astro Page Transition Compatibility

```javascript
document.addEventListener('astro:page-load', setupThemeToggle);
```

Re-initializes the component whenever an Astro page transition finishes.

---

## Sun / Moon Animation

### CSS Implementation

```css
/* Default state (Light mode): Sun */
.toggle input + div {
  border-radius: 50%;
  width: 36px;
  height: 36px;
  position: relative;
  /* Uses box-shadow to create main sun body */
  box-shadow: inset 16px -16px 0 0 var(--theme-toggle-color, #ffbb52);
  transform: scale(1) rotate(-2deg);
  transition:
    box-shadow 0.5s ease 0s,
    transform 0.4s ease 0.1s;
}

/* Sun rays (8 rays) */
.toggle input + div:after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  /* Uses multiple box-shadows to create rays */
  box-shadow:
    0 -23px 0 var(--theme-toggle-color),     /* Top */
    0 23px 0 var(--theme-toggle-color),      /* Bottom */
    23px 0 0 var(--theme-toggle-color),      /* Right */
    -23px 0 0 var(--theme-toggle-color),     /* Left */
    15px 15px 0 var(--theme-toggle-color),   /* Bottom-right */
    -15px 15px 0 var(--theme-toggle-color),  /* Bottom-left */
    15px -15px 0 var(--theme-toggle-color),  /* Top-right */
    -15px -15px 0 var(--theme-toggle-color); /* Top-left */
  transform: scale(0);  /* Initially hidden */
  transition: all 0.3s ease;
}

/* Checked state (Dark mode): Moon */
.toggle input:checked + div {
  /* Larger inset shadow forms moon shape */
  box-shadow: inset 32px -32px 0 0 var(--theme-background-color, #17181c);
  transform: scale(0.5) rotate(0deg);
}

/* Moon circular background */
.toggle input:checked + div:before {
  background: var(--theme-toggle-color, #ffbb52);
}

/* Rays expand in dark mode */
.toggle input:checked + div:after {
  transform: scale(1.5);
}
```

### Animation Diagram

```plain
Light Mode (Sun)                   Dark Mode (Moon)
    ·  ·  ·                     ╭──────╮
   ·  ╭──╮  ·                  │      │
  ·  │    │  ·       ──→      │   ○  │
   ·  ╰──╯  ·                  │      │
    ·  ·  ·                     ╰──────╯

  Yellow circle + 8 rays       Circle + inset shadow
```

---

## View Transitions Circular Expansion Animation

### CSS Configuration

```css
/* src/styles/theme/theme-transition.css */

/* Special animation during theme toggle */
.theme-transition::view-transition-old(root),
.theme-transition::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

/* Old view fades out */
.theme-transition::view-transition-old(root) {
  z-index: 1;
}

/* New view circular expansion */
.theme-transition::view-transition-new(root) {
  z-index: 9999;
  /* Circular clip-path starting from button position */
  clip-path: circle(0% at var(--x, 50%) var(--y, 50%));
  animation: theme-clip 0.5s ease-out forwards;
}

@keyframes theme-clip {
  from {
    clip-path: circle(0% at var(--x, 50%) var(--y, 50%));
  }
  to {
    clip-path: circle(150% at var(--x, 50%) var(--y, 50%));
  }
}
```

### Animation Principle

```plain
1. Click toggle button
   ┌─────────────────────┐
   │                     │
   │         ●          │  ← Click position (--x, --y)
   │                     │
   └─────────────────────┘

2. Circle begins expanding
   ┌─────────────────────┐
   │      ╭────╮         │
   │     │  ●  │        │  ← circle(10%)
   │      ╰────╯         │
   └─────────────────────┘

3. Continues expanding
   ┌─────────────────────┐
   │ ╭──────────────╮    │
   │ │       ●      │    │  ← circle(50%)
   │ ╰──────────────╯    │
   └─────────────────────┘

4. Covers entire page
   ┌─────────────────────┐
   │                     │
   │         ●          │  ← circle(150%)
   │                     │
   └─────────────────────┘
```

---

## Astro Page Transition Compatibility

### Problem

Astro's View Transitions do not trigger a full page refresh, leading to:
- Theme state potentially out of sync
- Event listeners potentially being lost

### Solution

```javascript
// Layout.astro - Check theme after every page load
<script>
  function checkTheme() {
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
       window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }

  // Check theme on every page load (including post-transition)
  document.addEventListener('astro:page-load', checkTheme);
</script>
```

---

## localStorage Persistence

### Storage Structure

```javascript
// Key: 'theme'
// Value: 'dark' | 'light' | undefined

localStorage.setItem('theme', 'dark');   // Dark mode
localStorage.setItem('theme', 'light');  // Light mode
localStorage.removeItem('theme');         // Follow system
```

### Priority Order

```javascript
// Check sequence
if (localStorage.theme === 'dark') {
  // 1. User explicitly selected dark
} else if (localStorage.theme === 'light') {
  // 2. User explicitly selected light
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  // 3. System prefers dark
} else {
  // 4. Default light
}
```

---

## CSS Variable System

### Theme Variable Definitions

```css
/* src/styles/theme/index.css */

/* Light mode variables */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... more variables */
}

/* Dark mode variables */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... more variables */
}
```

### Using Variables

```css
/* Usage in Tailwind CSS */
.bg-background {
  background-color: hsl(var(--background));
}

.text-foreground {
  color: hsl(var(--foreground));
}

/* Usage in custom CSS */
.custom-element {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
}
```

---

## Accessibility Support

### ARIA Attributes

```html
<div
  role="button"
  tabindex="0"
  aria-label="toggle theme"
>
  <label aria-label="toggle theme">
    <input type="checkbox" />
  </label>
</div>
```

### Keyboard Support

```javascript
// Supports Enter and Space key toggling
toggleBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    checkbox.click();
  }
});
```

---

## Key Takeaways

1. **FOUC Prevention**: Use `is:inline` script to set theme before rendering.
2. **View Transitions API**: Achieves circular expansion animation effect.
3. **localStorage**: Persists user theme preference.
4. **System Theme Sync**: Uses `prefers-color-scheme` media query.
5. **Astro Compatibility**: Listens to `astro:page-load` event.
6. **CSS box-shadow**: Creates sun/moon icon animation.
7. **CSS Variables**: Manages theme colors in a unified way.

---

## Related Files

| File | Description |
|------|-------------|
| `src/components/theme/ThemeToggle.astro` | Theme Toggle Component |
| `src/layouts/Layout.astro` | Theme Initialization Script |
| `src/styles/theme/index.css` | Theme CSS Variables |
| `src/styles/theme/theme-transition.css` | Theme Transition Animation |
