---
name: grid-inner-blocks
description: GRID per-cell innerBlocks, gridCells helpers, GridCellShell, and server CRUD patterns
---

# Grid Inner Blocks

## Data model (no Prisma migration)

- Children stay **flat** in `block.children[]` with `config.cell: { row, col }` and `position` within cell.
- Runtime-only `block.cells[]` attached by `nestBlocks` for GRID nodes (public/nested tree only). **Editor `GridRenderer` always calls `groupGridInnerBlocks`** from current config — never reads `block.cells`.
- Use `cellKey(row, col)` → `"r:c"`; `childCellKey(child)` for reorder filters.

## Component chain

```
EditorShell.handleAddToCell(gridId, type, defaults, cell)
  → BlockCanvas → BlockList → BlockWrapper → BlockRenderer → GridRenderer → GridCellShell
```

Top-level GRID in `BlockWrapper` uses `block-wrapper__chrome--grid`: drag handle **above** full-width grid (column flex), not beside it.

`handleAddBlock(type, defaults, { parentId, cell })` merges `cell` into POST `config`.

## Empty cells

No placeholder TEXT blocks. Empty cell → inline `BlockPicker` with `parentBlockId={gridId}`.
GRID cannot be added inside a grid cell (`insideGridCell` filter in BlockPicker).

## Server mutations (`blockMutations.js`)

| Function | When |
|----------|------|
| `assertGridUnique` | POST top-level GRID (409 if exists) |
| `createGridWithTakeover` | POST GRID when top-level blocks exist |
| `syncGridDimensions` | PATCH GRID columns/rows (inside existing `$transaction`) |
| `promoteGridChildren` | DELETE GRID — children become top-level, `config.cell` stripped |
| `deleteGridChildren` | Clear-canvas / cascade helpers (not used on single GRID delete) |

Clear canvas: `DELETE /api/blocks?projectId=` (soft-deletes all blocks including grid children).

## Editor chrome

```js
import { useEditorChrome } from '@/lib/hooks/useEditorChrome.js';

const { outlineColor, buttonFg } = useEditorChrome(pageBgHex); // bg must be resolved hex
useEditorChrome(pageBgHex, cellLocalBg); // cell override optional
```

`pickContrastColor(bg, { dark, light })` — never pass CSS var as `bg` input.

## Drag state

- `send({ type: 'DRAG_START', scope, parentId, cellKey, activeId })` from BlockList / GridCellShell
- `isDragging` boolean in `useEditor()`; full `dragState` via `useEditorActor()` only
- **Today:** one `DndContext` per `GridCellShell` (within-cell only). Top-level blocks use `BlockList`'s `DndContext`.
- **Cross-cell PR:** lift grid `DndContext` to `GridRenderer` — see below. Never leave `GridCellSortable` alongside `GridCellShell` during the refactor without removing duplicate contexts.

## Within-cell reorder (today)

- Each `GridCellShell` has its own `DndContext` — drag reorder **within** that cell only.
- `handleReorderChildren(gridId, reorderedChildren, cellKey)` → `POST /api/blocks/reorder` with `parentId: gridId`; updates **position** within the cell. Guards `orderedIds` with `.filter(Boolean)`.
- **Does not PATCH `config.cell`** on reorder — `cellKey` always equals the block's existing cell until cross-cell DnD exists. Patching cell to the same value would be a no-op today.
- New blocks in a target cell: `handleAddToCell` / `handleAddBlock(..., { parentId, cell })` sets `config.cell` on POST ✓

## Cross-cell DnD (not yet implemented)

**Prerequisite:** lift `DndContext` from `GridCellShell` to `GridRenderer`. Each cell currently owns an isolated `DndContext` — drag events never reach a shared coordinator, so cross-cell is impossible until the lift.

When implementing:

1. Single `DndContext` at `GridRenderer` level (not inside each `GridCellShell`)
2. Per-cell `SortableContext` still works inside it
3. `onDragEnd` at grid level: compare source `cellKey` vs destination `cellKey`
4. If different cells: PATCH `config.cell` on moved block + reorder within destination cell
5. Run PATCH + reorder in one async sequence before `loadBlocks` — avoid intermediate state flash

Do not add `config.cell` PATCH in `handleReorderChildren` until this lands — reorder alone leaves stale coordinates; reload puts blocks back via `groupGridInnerBlocks`.

## Recursive patches

`mergeInList` in EditorShell — referential stability when no match.
`handleReorderChildren(gridId, children, cellKey)` filters by `childCellKey` when `cellKey` set (within-cell scope only).

## Responsive layout (`dashboard.scss`)

- `.block-grid` — `grid-template-columns: var(--grid-cols)`; stacks to `1fr` below 768px
- `.block-grid__cell` — `min-width: 0` (grid children)
- `.block-canvas-item` — same constraint for top-level blocks (editor `BlockWrapper` + public `PublicPageBlocks`)
- GridRenderer sets **only** `--grid-cols` inline — never `gridTemplateColumns` directly; template uses `fr` from `buildGridColTemplate` (gap-aware, not `%`)
- `.grid-resize-handle` hidden on mobile
- Cell contrast outlines stay inline in `GridCellShell` (`useEditorChrome`) — not in SCSS

## Tests

`src/lib/blocks/gridCells.test.js` (`buildGridColTemplate`), `blockMutations.test.js`, `nestBlocks.test.js`, `editorMachine.test.js`, `pageDefaults.test.js` (`shouldAutoSeedGrid`)
