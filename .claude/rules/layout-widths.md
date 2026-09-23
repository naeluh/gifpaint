# Layout content widths

## DashboardLayout `contentWidth`

Pass `contentWidth` on `DashboardLayout` — do not set `width: 100%` or ad-hoc `max-width` on page wrappers.

| Prop | CSS variable | Max width | Use |
|------|--------------|-----------|-----|
| `narrow` | `--content-width-narrow` | 480px | Login, register, short auth flows (`hideSidebar`) |
| `medium` | `--content-width-medium` | 768px | Settings, long forms with sidebar |
| `full` (default) | `--content-width-full` | none | Editor, dashboard grids, card listings |

Narrow and medium presets add `dashboard-main--scroll` on `<main>` and wrap page content in `.dashboard-content__inner` (padding lives on the inner shell with `box-sizing: border-box`). Outer column only sets max-width; use `align-items: flex-start` on main — never `center` on a scroll flex child. `html:has(.dashboard)` / `body:has(.dashboard)` lock document scroll so only main scrolls. Full keeps `overflow: hidden` so the project editor scrolls inside `.dashboard-editor-content`.

## SCSS

- Tokens: `src/styles/_variables.scss` (`--content-width-narrow`, `--content-width-medium`, `--content-width-full`)
- Mixins: `src/styles/_mixins.scss` (`content-width-column`, `content-width-scrollable`)
- Classes: `src/styles/dashboard.scss` (`.dashboard-content--narrow`, `.dashboard-content--medium`)

When adding a new width preset, add a CSS variable, mixin usage in `dashboard.scss`, and a `contentWidth` value on `DashboardLayout`.

## Do not

- Wrap settings/forms in `<div style={{ width: '100%' }}>` inside `DashboardLayout`
- Hardcode `480px` / `768px` in page JSX
- Use `app-container` for in-app dashboard pages (900px cap; legacy marketing shell only)

## Sidebar width

- `.dashboard` sets `--sidebar-width` (default `56px`); `dashboard-main` uses `margin-left: var(--sidebar-width)`
- HoverSlideMenu `onMetricsChange({ width })` drives the CSS var; collapsed layout width is always `56px` (8px inline content padding → 40px circle nav buttons matching the collapse toggle)
