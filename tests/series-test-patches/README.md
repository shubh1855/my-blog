# Multi-Series Feature Testing Guide

This document explains how to use patch files to test various scenarios of the multi-series feature.

## Prerequisites

```bash
# Make sure the workspace is clean
git status

# If there are uncommitted changes, stash them first
git stash
```

---

## Test 1: Add Second Series (Book Excerpts)

**Objective**: Verify that the multi-series feature functions properly

### Apply Patch

```bash
git apply tests/series-test-patches/01-add-reading-series.patch
```

### Changes Included

- `config/site.yaml`:
  - Add `书摘: reading` to `categoryMap`
  - Add second series configuration to `featuredSeries`
  - Add "Book Excerpts" navigation item to `navigation`
- Create new test article `src/content/blog/reading/test-book.md`

### Verification Steps

1. Start development server
   ```bash
   pnpm dev
   ```

2. Check the following pages:
   - [ ] Homepage: Should display the latest article highlight card for the "Book Excerpts" series
   - [ ] `/reading`: Series page displays normally with test articles
   - [ ] Navigation bar: "Book Excerpts" menu item should appear
   - [ ] `/weekly`: Weekly series page still functions normally

3. Build test
   ```bash
   pnpm build
   ```
   Build should complete without errors.

### Revert

```bash
git checkout -- .
rm -rf src/content/blog/reading  # Delete newly created test article directory
```

---

## Test 2: Disable Weekly Series

**Objective**: Verify that `enabled: false` correctly disables a series

### Apply Patch

```bash
git apply tests/series-test-patches/02-disable-weekly.patch
```

### Changes Included

- `config/site.yaml`: Change `enabled: true` to `enabled: false` for the weekly series

### Verification Steps

1. Start development server
   ```bash
   pnpm dev
   ```

2. Check the following:
   - [ ] Homepage: Should NOT display the highlight card for the weekly series
   - [ ] `/weekly`: Accessing should return a 404 page
   - [ ] Sidebar: Should NOT display the weekly entry

3. Build test
   ```bash
   pnpm build
   ```
   Build should complete without errors and should not generate `/weekly` related pages.

### Revert

```bash
git checkout -- .
```

---

## Test 3: Reserved Route Conflict Error

**Objective**: Verify that using a reserved route as a slug triggers a build error

### Apply Patch

```bash
git apply tests/series-test-patches/03-test-reserved-slug-error.patch
```

### Changes Included

- `config/site.yaml`: Change slug from `weekly` to `categories` (a reserved route)

### Verification Steps

1. Attempt build
   ```bash
   pnpm build
   ```

2. Expected Result:
   - [ ] Build should **fail**
   - [ ] Error message should indicate that `categories` is a reserved route
   - [ ] Error message should list all reserved route names

3. Development mode should also report an error
   ```bash
   pnpm dev
   ```
   - [ ] A configuration error warning should be displayed on startup

### Revert

```bash
git checkout -- .
```

---

## Test 4: Disable Homepage Highlight

**Objective**: Verify that `highlightOnHome: false` can turn off homepage highlight display

### Apply Patch

```bash
git apply tests/series-test-patches/04-test-highlight-off.patch
```

### Changes Included

- `config/site.yaml`: Add `highlightOnHome: false` to the weekly series

### Verification Steps

1. Start development server
   ```bash
   pnpm dev
   ```

2. Check the following:
   - [ ] Homepage: Should **NOT** display the weekly series highlight card
   - [ ] `/weekly`: Series page still works normally
   - [ ] Navigation bar: Weekly menu item still exists

3. Build test
   ```bash
   pnpm build
   ```
   Build should complete without errors.

### Revert

```bash
git checkout -- .
```

---

## Combined Testing (Optional)

You can also combine multiple patches for more complex testing:

```bash
# Enable book excerpts series + turn off weekly homepage highlight at the same time
git apply tests/series-test-patches/01-add-reading-series.patch
git apply tests/series-test-patches/04-test-highlight-off.patch

pnpm dev
# Verify: Homepage only displays book excerpts highlight, does not display weekly highlight

# Revert
git checkout -- .
rm -rf src/content/blog/reading
```

---

## Quick Reference

| Patch | Test Scenario | Expected Result |
|-------|---------|---------|
| `01-add-reading-series.patch` | Add a second series | Works normally, both series coexist |
| `02-disable-weekly.patch` | Disable series | Series page 404, no highlight on homepage |
| `03-test-reserved-slug-error.patch` | Reserved route conflict | Build fails with error prompt |
| `04-test-highlight-off.patch` | Disable homepage highlight | Series page normal but no homepage highlight card |

---

## After Testing is Complete

```bash
# Ensure all changes are reverted
git checkout -- .
rm -rf src/content/blog/reading  # If patch 01 was tested

# Restore previously stashed changes (if any)
git stash pop
```
