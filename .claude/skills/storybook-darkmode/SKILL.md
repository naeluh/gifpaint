---
name: storybook-darkmode
description: Ensures all primitives and components follow dark-mode styling using CSS variables (--black-oil-1000 background, --white-ghost-100 borders/text). Use when creating UI components, styling primitives, updating Dropdown/Button/form elements, or fixing component appearance in dark mode.
---

# Storybook Dark Mode Consistency

This project is **dark-only**. All UI components must use CSS variables and project design tokens, never hardcoded colors.

## Core Requirements

Every component (primitive or composed) must:

1. **Use project CSS variables** from `src/styles/_variables.scss`
   - Dark background: `--black-oil-1000` (#0d1117)
   - Light border/text: `--white-ghost-100` (#ffffff)
   - Secondary background on hover: `--color-bg-secondary`
   - Transitions: `--transition-fast`

2. **Import styles correctly**
   ```scss
   @import '../../styles/variables';  // CSS variables
   @import '../../styles/mixins';      // Mixins like @include focus-ring
   ```

3. **Remove hardcoded colors** (especially light mode defaults)
   - ❌ Bad: `background-color: #fff`, `border: 1px solid #d1d5db`
   - ✅ Good: `background: var(--black-oil-1000)`, `border: 2px solid var(--white-ghost-100)`

4. **Use consistent spacing and typography**
   - Spacing: `var(--spacing-1)` through `var(--spacing-6)`
   - Font: `var(--font-family-base)`
   - Weight: `var(--font-weight-semibold)`, `var(--font-weight-normal)`
   - Size: `var(--font-size-base)`, `var(--font-size-sm)`, `var(--font-size-lg)`

5. **Remove light-mode media queries**
   - Delete: `@media (prefers-color-scheme: light)` or `@media (prefers-color-scheme: dark)`
   - Keep only: Dark mode styles (they're always active)

## Component Styling Checklist

### Dropdown (and similar patterns)

**Trigger Button:**
```scss
.dropdown-trigger {
  // Use Button foundation
  padding: var(--spacing-2) var(--spacing-4);
  border: 2px solid var(--white-ghost-100);
  background: var(--black-oil-1000);
  color: var(--white-ghost-100);
  
  &:hover:not(:disabled) {
    background: var(--color-bg-secondary);
  }
  
  &:focus-visible {
    @include focus-ring;  // Provides dark-mode compliant focus
  }
}
```

**Menu Container:**
```scss
.dropdown-menu {
  background-color: var(--black-oil-900);
  border: 2px solid var(--white-ghost-100);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);  // Dark shadow
}
```

**Menu Items:**
```scss
.dropdown-item {
  color: var(--white-ghost-100);
  
  &:hover:not(:disabled) {
    background-color: var(--black-oil-800);
  }
}
```

## Common Dark Mode Values

| Element | Property | Value |
|---------|----------|-------|
| Backgrounds | Primary | `--black-oil-1000` |
| Backgrounds | Secondary | `--color-bg-secondary` |
| Backgrounds | Hover/Active | `--black-oil-800` or `--black-oil-700` |
| Text/Borders | Light | `--white-ghost-100` |
| Text/Borders | Muted | `--white-ghost-300` |
| Destructive | Text | `--safety-orange-500` |
| Destructive | Background | `--safety-orange-1000` |

## Quick Fixes

### If component looks light-colored on dark background
1. Check `background-color` or `background` — should use a `--black-oil-*` variable or `transparent`
2. Check `color` — should use `--white-ghost-100`
3. Check `border-color` — should use `--white-ghost-100`
4. Remove any hardcoded hex values like `#fff`, `#374151`, `#f9fafb`

### If borders/text are hard to see
1. Ensure border uses `--white-ghost-100` (not `--white-ghost-300` or lighter)
2. Ensure text color is `--white-ghost-100`
3. Check contrast in DevTools

### If media queries exist
1. Delete `@media (prefers-color-scheme: light)`
2. Delete `@media (prefers-color-scheme: dark)` wrapping
3. Move dark-mode styles to root level (they're always active)

## Example: Before & After

**Before (incorrect):**
```scss
.dropdown-trigger {
  background-color: #fff;
  border: 1px solid #d1d5db;
  color: #374151;
  
  &:hover {
    background-color: #f9fafb;
  }
  
  @media (prefers-color-scheme: dark) {
    background-color: #1f2937;
    color: #f9fafb;
  }
}
```

**After (correct):**
```scss
.dropdown-trigger {
  padding: var(--spacing-2) var(--spacing-4);
  border: 2px solid var(--white-ghost-100);
  background: var(--black-oil-1000);
  color: var(--white-ghost-100);
  transition: all var(--transition-fast);
  
  &:hover:not(:disabled) {
    background: var(--color-bg-secondary);
  }
  
  &:focus-visible {
    @include focus-ring;
  }
}
```

## When to Create vs. Update

- **Updating existing primitives**: Apply this skill whenever fixing component appearance
- **Creating new primitives**: Follow [.claude/rules/storybook.md](.claude/rules/storybook.md) structure + this dark mode approach
- **Styling form elements**: Use `Button` + `FormGroup` primitives (already dark-compliant)

## Files to Check

- `src/primitives/*/ComponentName.scss` — verify dark mode styles
- `src/styles/_variables.scss` — reference for available tokens
- `src/styles/_mixins.scss` — reference for `@include focus-ring` and other utilities
- `src/primitives/Button/Button.scss` — reference for correct dark mode button styling

## Dashboard / HoverSlideMenu stories

- `parameters.backgrounds.default: 'black-oil'`, `storageKey={null}` / `sidebarStorageKey={null}`, use `AppSidebar` not hand-rolled nav buttons
