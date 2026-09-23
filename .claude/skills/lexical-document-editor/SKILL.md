---
name: lexical-document-editor
description: Lexical single-document editor — migration, save, toolbars
---

# Lexical document editor

## Architecture

- One TEXT `ProjectBlock` row holds the full page (`text` Lexical JSON, `textHtml`).
- `prepareDocumentFromBlocks(blocks)` on load — merge or seed document block.
- `blocksToLexicalDocument` uses `createEditor({ nodes: WYSIWYG_NODES })` from `lexical` (not `@lexical/headless`).

## Save (page scope)

- **PUT `/api/pages/[rkey]`** with `content`, `contentHtml`, `documentBlockId`, `completeMigration`.
- Server: `persistPageDocument.js` — UUID upsert + idempotent orphan soft-delete (keeps `LAYOUT`).
- Client: `EditorShell` page scope only (`!isTermCanvas`); term canvas still uses `/api/taxonomy/term-blocks`.
- 409 on cross-project `documentBlockId` → client generates new UUID and retries once.

## Migration idempotency

- `legacyBlocksExist` ref re-derived from GET `blocks[]` on load (not localStorage).
- While true: every autosave sends `completeMigration: true` + `migrated: true` in JSON.
- First successful PUT with `migrationComplete: true` clears ref and orphan list.
- `stripMigrationEnvelope(text)` before seeding composer.

## Save timing

- `AutoSavePlugin` only (1500ms debounce); `disabled` during migration lock.
- `dirtyWhileLocked` flushes one save when lock clears.

## Toolbars

- Bottom: `WYSIWYGToolbar layout="editor-pill"`.
- Floating: always mounted; hidden via `visibility` + `pointer-events: none`.
- `onMouseDownCapture={preventToolbarMousedown}`; `closest('input, textarea, select')` skips preventDefault.
- `setFloatingElemPosition` — anchor-relative coords (no `window.scrollX/Y`).

## Config panel

- `LexicalNodeConfigForm` — video border/maxWidth fields on `VideoNode`.
- Node form stays open while editing fields (editor may blur).
- Deselect: Escape or new text selection → `DESELECT` on machine.

## Preview

- `findPreviewableProjectBySlugOrRkey` — owner, admin, or active cohort member.
- `filterPreviewBlocks` — safety net when `migrated: true` TEXT exists alongside orphans.
- Preview route: `export const dynamic = 'force-dynamic'`.

## Deprecated for page editor

- `/api/blocks` PATCH/DELETE for document save — use pages PUT instead.
