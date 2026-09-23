# Design language — named rules (Kuzic-inspired discipline, OSS palette)

Dark-only, black-oil/white-ghost identity. These rules are enforceable; cite them by name in reviews.

1. **One Accent Rule** — `--color-accent` (safety yellow `#f4d03f`, text `--color-accent-fg`) marks only: the single primary CTA per screen (`<Button variant='accent'>` — publish, create), active/selected markers, new badges. Never a background wash, border tint, or decoration. Success = `--color-success`; destructive = error variant.
2. **Surface Ladder Rule** — depth via oil ladder only: page `--black-oil-1000` → card `--black-oil-900` → hover `--black-oil-800` → active `--black-oil-700`. Dense lists/cards use `--border-hairline` + `--shadow-card` (`--shadow-raised` for the active/"you are here" element); the 2px `--white-ghost-100` border stays on inputs and primary containers.
3. **One Focus Rule** — `@include focus-ring` on every interactive element; never removed, never re-colored per surface.
4. **Section-Header-Stays-Big Rule** — top-level section titles share one size/weight; small uppercase eyebrows only inside dense surfaces (dropdown groups, card micro-labels). Never demote a page section header to a caption.
5. **No-Spinner Rule** — route/section loads render `Skeleton`/`SkeletonList` (`@/primitives`) mirroring real geometry (varied row widths, `aria-busy` live region, mobile/desktop variants when layouts differ; skeleton ships in the same PR as the page). Spinners only inside an already-painted surface (inline "Saving…").
6. **One Sheet Rule** — add/create/settings surfaces use `Sheet` + `SheetActionList`/`SheetActionRow` (`@/primitives`). No bespoke modals per surface; config that has no visible result lives in a sheet, not a route (see CMS plan D7/D11).
7. **Voice Rule** — empty states use `EmptyState` (`@/primitives`): one warm line + the next action ("No pages yet — write one."). Errors name cause + next move. Toggle labels positivity-first (Publish → Published; never Un-verbs except true destructive pairs). Contractions, "you", no exclamation marks, no emoji in UI.
8. **Hover-Elevate Rule** — hover/press = one step up the oil ladder (`--color-bg-secondary`), never a hue shift, never an accent tint.
9. **Hit-Area Rule** — interactive targets ≥40px (44px touch); menus become bottom `Sheet` on small screens.

Tokens live in `src/styles/_variables.scss` (design-language block). Plan context: `docs/CMS_REFACTOR_PLAN.md` §2.5.
