---
name: inline-block-editing
description: Inline canvas editing for TEXT blocks; legacy HTML/MARKDOWN normalized on load
---

# Inline Block Editing

## When to use

Canvas inline editing for TEXT blocks in the project editor (`/project/{slug}/edit`).
HTML and MARKDOWN blocks are **legacy types** — normalized to TEXT client-side on load
via `normalizeEditorBlock()`. The DB type is migrated on the first real user edit.

## Normalization on load

```js
// EditorShell.jsx — loadBlocks
import { normalizeEditorBlock } from '@/lib/blocks/shared/inlineContent.js';
// ...
setBlocks((data.blocks ?? []).map(normalizeEditorBlock));
```

`normalizeEditorBlock` converts HTML/MARKDOWN → TEXT in client state:
1. If `block.text` is valid Lexical JSON → keep as-is (already migrated)
2. If `block.textHtml` is present → `htmlToPlainText(textHtml)` (plain prose, no raw tags)
3. Otherwise → raw `block.text` string

Recurses into `block.children` (grid cells).

## Patch shapes

| Block type | Canvas editor | PATCH payload | API `textHtml` |
|------------|---------------|---------------|----------------|
| TEXT | Rich Lexical composer | `{ type: 'TEXT', text: lexicalJson, textHtml }` | From client `textHtml` (sanitized by API) |
| HTML (DB) | Migrated to TEXT on first edit | `{ type: 'TEXT', text: lexicalJson, textHtml }` | Sanitized by API |
| MARKDOWN (DB) | Migrated to TEXT on first edit | `{ type: 'TEXT', text: lexicalJson, textHtml }` | Sanitized by API |

**TEXT serialization (critical):**

```js
const contentJson = JSON.stringify(editorState.toJSON()); // never JSON.stringify(editorState)
```

Use `buildInlinePatch()` from `src/lib/blocks/shared/inlineContent.js`.

## Suppressing initial onChange

Use double `requestAnimationFrame` via `ignoreInitialChangeRef` to suppress the first
`onChange` call emitted as Lexical hydrates from initial state. Reset on `block.id` change.

```js
const ignoreInitialChangeRef = useRef(true);
useEffect(() => {
  ignoreInitialChangeRef.current = true;
  const outer = requestAnimationFrame(() => {
    const inner = requestAnimationFrame(() => { ignoreInitialChangeRef.current = false; });
    return () => cancelAnimationFrame(inner);
  });
  return () => cancelAnimationFrame(outer);
}, [block.id]);
```

## onChange emits type: 'TEXT'

```js
// TextInlineEditor.jsx
onChange?.({ type: 'TEXT', ...buildInlinePatch('TEXT', payload) });
```

Ensures legacy DB rows (HTML/MARKDOWN) are migrated to TEXT on first real edit.
Selection alone (without typing) does NOT trigger a PATCH — `ignoreInitialChangeRef` guards this.

Route handler: HTML|MARKDOWN → TEXT only; `type: 'TEXT'` on an existing TEXT row is a no-op.

## BlockRenderer

In `editorMode`, text-like blocks use plugin `EditorConfig` (not `Renderer`):

```jsx
const View = editorMode && EditorConfig && isTextLikeBlock(block.type)
  ? EditorConfig
  : Renderer;
```

Path: `TEXT` → `TextEditorConfig` → `TextInlineEditor` → `WYSIWYGContent` when `block.id === primaryBlockId`.

## Inline edit gate

```jsx
// text/EditorConfig.jsx — primary owns Lexical surface; others preview
<TextInlineEditor
  block={block}
  isSelected={!!selected}
  isPrimary={block.id === primaryBlockId}
  onChange={onChange}
/>
```

After normalization-on-load, legacy blocks are TEXT in client state.

## Single shell composer + toolbar pill

`EditorShell` wraps canvas + toolbar in one `<WYSIWYG key={primaryBlock.id} showToolbar={false}>`.

```jsx
<WYSIWYGToolbar layout="editor-pill" className="dashboard-editor-toolbar" />
```

`layout="editor-pill"` → `toolbar--editor-pill` (row layout; embed popup absolute above pill).
No per-block composers; no toolbar portal.

## Component map

- `src/lib/blocks/shared/inlineContent.js` — `normalizeEditorBlock`, `getInlineInitialState`, `buildInlinePatch`, `getPlainSource`, `htmlToPlainText`
- `src/lib/blocks/plugins/text/EditorConfig.jsx` — gate + `TextInlineEditor`
- `src/components/editor/TextInlineEditor.jsx` — `ignoreInitialChangeRef`, type: 'TEXT' in patch, `WYSIWYGContent` when primary
- `src/primitives/WYSIWYG/WYSIWYG.js` — shell `WYSIWYG`, `WYSIWYGContent`, `WYSIWYGToolbar layout="editor-pill"`
- `EditorShell` — single composer + `dashboard-editor-wysiwyg-root` layout
- `BlockRenderer` — `EditorConfig` for text-like blocks in `editorMode`
- `ConfigPanel` → `BlockConfigForm` — media/grid config only; no HTML/MARKDOWN source textarea

## Escape handling

EditorShell uses a DOM focus check rather than a derived selector:

```js
if (ae?.closest?.('.wysiwyg-input, [contenteditable="true"]')) return;
```

## Machine events (EditorShell)

```js
setSelectedBlockId(id, blockType)  // → SELECT_BLOCK; sets primaryBlockId when blockType === 'TEXT'
send({ type: 'SET_PRIMARY', id })
send({ type: 'DESELECT' })
send({ type: 'TOGGLE_PANEL' })
send({ type: 'SET_PANEL_WIDTH', width })
send({ type: 'DRAG_START', scope, parentId, cellKey, activeId })
send({ type: 'DRAG_END' })
```

Derived selectors from `useEditor()`: `showPageMeta`, `showBlockConfig`, `isTextLikeSelection`,
`panelOpen`, `panelWidth`, `selectedBlockType`, `isDragging`.

Only one TEXT composer mounts at a time. `activeEditorRef` is cleared by `EditorRefPlugin` on unmount.

## Duplicate-as-migration

Duplicating a normalized legacy block (HTML/MARKDOWN in DB, TEXT in client) creates a new TEXT
row immediately — the duplicate POST uses the client-state type. This is accepted behavior.

## Future direction (post-sprint)

- HTML→Lexical / Markdown→Lexical structural import (headings, lists, links as Lexical nodes)
- Custom block types as Lexical `DecoratorNode` wrappers
- Unified single-document compositor (only after auditing GRID nesting + per-cell DnD)
