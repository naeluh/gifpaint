# Component Styling — Dark Mode Consistency Rule

## Automatic Skill Invocation

**Load the `storybook-darkmode` skill automatically** whenever:
- Creating or modifying primitives in `src/primitives/*/`
- Creating or modifying components in `src/components/`
- Updating `.scss` or `.css` files in the above directories
- Working with component styling, theming, or dark mode appearance
- Reviewing or fixing component color, border, or background properties
- Creating new styled components or form elements

## Rule: All Component Styling Must Use CSS Variables

### Golden Rule
**No hardcoded colors.** All component styling must use design tokens from `src/styles/_variables.scss`.

### Quick Checklist

Before shipping any component styling changes:

- [ ] All colors use `var(--*)` CSS variables (no hex, rgb, or named colors)
- [ ] Background uses `--black-oil-1000` (primary) or `--color-bg-secondary` (hover)
- [ ] Text/borders use `--white-ghost-100` (primary) or `--white-ghost-300` (muted)
- [ ] Spacing uses `var(--spacing-1)` through `var(--spacing-6)` (not hardcoded px)
- [ ] Typography uses `var(--font-family-base)`, `var(--font-weight-*)`, `var(--font-size-*)`
- [ ] Transitions use `var(--transition-fast)` (not hardcoded ms)
- [ ] No media queries for `prefers-color-scheme: light` (dark-only project)
- [ ] Focus states use `@include focus-ring` mixin from `src/styles/_mixins.scss`

### Component Files Structure

Every primitive/component must follow:

```
src/primitives/ComponentName/
  ├── index.js                    # Re-exports only
  ├── ComponentName.js            # Component implementation
  ├── ComponentName.scss          # Scoped styles (CSS variables only!)
  └── ComponentName.stories.js    # Storybook story
```

### Imports Required in .scss Files

```scss
@import '../../styles/variables';  // Access --black-oil-*, --white-ghost-*, etc.
@import '../../styles/mixins';      // Access @include focus-ring, @include breakpoint, etc.
```

### Common Dark Mode Values

| Use Case | Variable | Color |
|----------|----------|-------|
| Primary background | `--black-oil-1000` | #0d1117 |
| Secondary background | `--black-oil-900` | #25292f |
| Hover/Active background | `--black-oil-800` | #3d4146 |
| Active/Focus background | `--black-oil-700` | #55595d |
| Primary text/border | `--white-ghost-100` | #ffffff |
| Muted text/border | `--white-ghost-300` | #fdfefe |
| Secondary background on hover | `--color-bg-secondary` | var(--black-oil-800) |
| Fast transitions | `--transition-fast` | all 0.15s ease |

### Red Flags to Avoid

- ❌ `background: #fff` or `background: #1f2937` → Use CSS variables
- ❌ `border: 1px solid #d1d5db` → Use `2px solid var(--white-ghost-100)`
- ❌ `padding: 8px 16px` → Use `var(--spacing-2) var(--spacing-4)`
- ❌ `@media (prefers-color-scheme: dark)` → Delete this; dark mode is always active
- ❌ `outline: 2px solid #3b82f6` → Use `@include focus-ring` mixin
- ❌ `font-size: 14px` → Use `var(--font-size-base)`

### Examples

**Before (❌ Hardcoded colors):**
```scss
.button {
  background: #fff;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 8px 16px;
  
  &:hover {
    background: #f9fafb;
  }
  
  @media (prefers-color-scheme: dark) {
    background: #1f2937;
    color: #f9fafb;
  }
}
```

**After (✅ CSS variables):**
```scss
.button {
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

## When to Reference

- **Fixing component appearance**: Read the `storybook-darkmode` skill
- **Creating new primitive**: Follow [storybook.md](storybook.md) + this rule for styling
- **Updating form elements**: Ensure Button, Input, etc. use dark mode variables
- **Styling dropdown/menu components**: Reference Dropdown.scss as the model implementation

## Files as Reference

- `src/primitives/Button/Button.scss` — Button implementation (reference for correct dark mode)
- `src/primitives/Dropdown/Dropdown.scss` — Dropdown implementation (reference for correct dark mode)
- `src/styles/_variables.scss` — All available CSS variables
- `src/styles/_mixins.scss` — Utility mixins like `@include focus-ring`

---

**Remember**: This project is **dark-only**. All UI is dark background with light text/borders. No hardcoded colors. Use CSS variables.
