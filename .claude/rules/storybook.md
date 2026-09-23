# Storybook Component Rule

## Always check Storybook before writing UI

Before creating any UI element, check whether it already exists in the primitive or component library.

**Primitives** live in `src/primitives/` and are exported from `src/primitives/index.js`.
**Components** live in `src/components/` and are exported from `src/components/index.js`.

```
src/primitives/
  Accordion, AspectRatio, AssetLibraryDropdown, Avatar, Button, Card, Dialog,
  Dropdown, FormElements (Checkbox, FormGroup, Input, Label, Radio, Select, Textarea),
  HoverSlideMenu, PageCard, Progress, Separator, SlideMenu, Slot, Tabs, Toolbar,
  VisuallyHidden, WYSIWYG

src/components/
  AppSidebar, BackgroundPicker, DashboardLayout, PageNavigator, UrlInput
```

## Rule 1 — Use what exists

If a primitive covers your need, import it. Do not recreate it inline.

```jsx
// ✅ correct
import { Button, FormGroup, Input, Label } from '@/primitives';

// ❌ wrong — never write a raw <button> when Button exists
<button className="btn" onClick={...}>Save</button>
```

Common imports:

```jsx
import {
  Button,
  FormGroup,
  Input,
  Label,
  Select,
  Textarea
} from '@/primitives';
import { Card, Dialog, Tabs, Dropdown } from '@/primitives';
import { DashboardLayout } from '@/components';
```

## Rule 2 — If it doesn't exist, create it following the existing pattern

Every primitive follows this exact file structure:

```
src/primitives/MyComponent/
  index.js               ← re-export only
  MyComponent.js         ← component implementation
  MyComponent.scss       ← scoped styles
  MyComponent.stories.js ← Storybook stories (REQUIRED)
```

**index.js**

```js
export { MyComponent } from './MyComponent.js';
```

**MyComponent.js**

```js
import './MyComponent.scss';
import { clsx } from 'clsx';

/**
 * MyComponent — one-line description.
 * @param {object} props
 * @param {string} [props.variant] - 'default' | 'ghost' | 'destructive'
 * @param {string} [props.size]    - 'small' | 'medium' | 'large'
 * @param {string} [props.className]
 */
export function MyComponent({
  variant = 'default',
  size = 'medium',
  className,
  children,
  ...props
}) {
  return (
    <div
      className={clsx(
        'my-component',
        `my-component--${variant}`,
        `my-component--${size}`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

**MyComponent.scss**

```scss
// Use project CSS variables — never hardcode colors or spacing
.my-component {
  // base styles

  &--ghost {
    /* variant */
  }
  &--small {
    /* size */
  }
}
```

**MyComponent.stories.js** (REQUIRED — no component without a story)

```js
import { MyComponent } from './MyComponent.js';

export default {
  title: 'Primitives/MyComponent',
  component: MyComponent,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'ghost', 'destructive']
    },
    size: { control: 'select', options: ['small', 'medium', 'large'] }
  }
};

export const Default = { args: { children: 'Example' } };
export const Ghost = { args: { variant: 'ghost', children: 'Ghost' } };
```

After creating, add the export to `src/primitives/index.js`.

## Rule 3 — Components (not primitives) follow the same pattern, no graphql file

Components in `src/components/` are page-level compositions. Same file structure
but placed in `src/components/MyComponent.jsx` (single file is fine for small ones)
with a corresponding `src/components/MyComponent.stories.js`.

## Rule 4 — CSS variables, not hardcoded values

This project uses a design token system in `src/styles/_variables.scss`.
Always use variables:

```scss
// ✅
color: var(--color-text-primary);
padding: var(--spacing-4);
border-radius: var(--radius-md);

// ❌
color: #333;
padding: 16px;
```

## Rule 5 — Auth UI uses existing form primitives

Login, register, and OAuth buttons must use `Button`, `Input`, `Label`, `FormGroup`.
OAuth provider buttons follow the same `Button` API with an icon slot:

```jsx
<Button variant='ghost' size='medium' onClick={handleGithubLogin}>
  {/* icon inline — no new icon primitive needed */}
  <svg>...</svg>
  Continue with GitHub
</Button>
```

## Rule 6 — No new dependencies for UI

Do not add a UI library (Radix, shadcn, MUI, etc.) to solve a problem that an
existing primitive or a new hand-rolled primitive can solve.

## Rule 7 — Every new page needs a `Pages/` story

Any new `src/app/*/page.jsx` must have a corresponding story in `src/stories/`.
Follow the exact pattern used in `src/stories/Dashboard.stories.js`:

```js
import { AuthProvider } from '@/context/AuthContext';
import MyPage from '../app/my-route/page';

export default {
  title: 'Pages/MyPage',
  component: MyPage,
  parameters: { layout: 'fullscreen' },
};

export const Default = {
  render: () => (
    <AuthProvider>
      <MyPage />
    </AuthProvider>
  ),
};
```

- Title must be `'Pages/<PageName>'` to appear in the correct Storybook section.
- Always wrap with `<AuthProvider>` — pages may call `useAuth()`.
- Page components often include `DashboardLayout` themselves; stories do not wrap layout again.
- If the page requires router params, add `parameters.nextjs.router` (see `EditorPage.stories.js`).
- File lives in `src/stories/` (not alongside the page component).

## Storybook commands

```bash
bun run storybook          # dev server on :6006
bun run build-storybook    # static build
bun run generate -- ComponentName --type=primitive  # scaffold new primitive
```

## HoverSlideMenu sidebar

- Resizable + collapsible; stories use `storageKey={null}`; never inline styles on `__btn-label`
- Use `__btn-icon` + `__btn-label` BEM; icons via `lucideIconProps()`

## Public / preview pages

- `PublicPageBlocks`: `page-canvas wysiwyg-surface` + `WYSIWYG-surface.scss` only (not full `WYSIWYG.scss`)
- Contrast: `useContrastColor` for `--wysiwyg-fg` / `--wysiwyg-link` — see `.claude/skills/public-page-render/SKILL.md`
