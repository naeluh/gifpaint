# Unified Editor Toolbar

## Toolbar structure

The editor at `/project/{slug}/edit` has a bottom toolbar row:

- **Left:** Meta button (config panel toggle)
- **Center:** single scrollable pill — block-type icons (TEXT, HTML, …) + format controls + inline media
- **Right:** (reserved)

`EditorShell` wraps the canvas + toolbar in **one** `WYSIWYG` / `LexicalComposer` keyed to the primary TEXT block. `WYSIWYGToolbar` sits in the center group as a sibling of `BlockCanvas` content — same pattern as `DashboardPageDemo`.

Toolbar pill contents:

`[block icons] | [Format ▾ flyout] | [inline image video audio embed gallery]`

The **Format** flyout (`ToolbarFormatFlyout`) holds undo/redo, block type, B/I/U/S, lists, link, HR, alignment — opens above the pill (Lexical-style). Main pill stays compact; no horizontal scroll for format controls.

## Single-composer pattern

```jsx
// EditorShell.jsx
<WYSIWYG key={primaryBlock.id} editorRef={activeEditorRef} showToolbar={false}>
  <BlockCanvas />  {/* primary TEXT block renders <WYSIWYGContent /> only */}
  <div className="dashboard-editor-toolbar-row">
    <BlockPickerButton />
    <AssetLibraryDropdown>Image</AssetLibraryDropdown>
    <WYSIWYGToolbar layout="editor-pill" className="dashboard-editor-toolbar" onInsertVideo={...} />
  </div>
</WYSIWYG>
```

`WYSIWYGToolbar` / `ToolbarPlugin` must be a descendant of `LexicalComposer` — mount inside the shell-level `WYSIWYG`, not via portal.

## activeEditorRef wiring

- `LexicalMediaProvider` passes `activeEditorRef` (same ref as `EditorContext.activeEditorRef`)
- Shell `WYSIWYG`: `editorRef={activeEditorRef}` + `onEditorReady={drainPendingLexicalInsert}`
- Primary `TextInlineEditor`: `<WYSIWYGContent />` only (no nested composer)

## Media insert flow

1. Toolbar button → `useLexicalMedia()` callback
2. `EditorShell.ensurePrimaryTextForInsert()` (may auto-add TEXT block)
3. Asset picker opens (controlled `AssetLibraryDropdown`) or embed URL parsed via `parseEmbedUrl`
4. `dispatchLexicalInsert(command, payload)` — queues if ref not ready

## Floating format toolbar (Lexical document editor)

- Mount: `LexicalDocumentEditor` — `FloatingFormatToolbarPlugin` inside `.wysiwyg-editor-scroller`
- **Portal:** toolbar renders into `anchorElem` (`.wysiwyg-editor-scroller`) via `createPortal` — base CSS `top: 0; left: 0; will-change: transform`
- **Position anchor:** `.wysiwyg-editor-scroller` (`anchorElem`)
- **Scroll container:** `.page-canvas.dashboard-editor-content` (`scrollElem` via `PageCanvasSurface.scrollRef`)
- Do **not** infer scroll parent from `anchorElem.parentElement` in `setFloatingElemPosition`
- **Zoom gap:** range rects are not CSS-scale aware — document if canvas gets transform scale
- Node selection mode: type icon + Configure + width toggle + Delete (requires decorator `*Component` + `useDecoratorNodeSelection`)

## Draggable blocks + slash picker (Lexical 0.44+)

- **Two files** (playground mirror): `DraggableBlockPlugin.jsx` + `ComponentPickerPlugin.jsx`; shared `componentPickerOptions.js` + `ComponentPickerMenuItem.jsx`
- Draggable: official `DraggableBlockPlugin_EXPERIMENTAL` from `@lexical/react`; mount on scroller anchor in `LexicalDocumentEditor`
- Slash `/`: `LexicalTypeaheadMenuPlugin` in `WYSIWYGEditorPlugins` (composer root)
- **+** picker: portal to `document.body`; dismiss via `mousedown` + `getComposedEventTarget` (checks picker + menu refs)
- **Node lookup:** use `editor.getEditorState().read()` until Lexical ≥ 0.46 (`editor.read('latest', …)`)
- **A11y:** native `<button>` on drag menu; `:focus-visible` outline on `.draggable-block-menu__btn`
- **Handle styling:** Lexical playground parity in `WYSIWYG.scss` — dark icons (`#333`) at 30% opacity, `#efefef` hover; **not** the dark floating pill (`--black-oil-1000` shell chrome)
- **Touch:** HTML5 DnD not supported — document in README/CHANGELOG
- **Tests:** manual checklist `docs/EDITOR_MANUAL_TESTS.md` (drag, focus, picker dismiss)

See `.claude/skills/lexical-media-config/SKILL.md`.

## Hook order

All hooks in `ToolbarPlugin` run unconditionally. Guard side-effects with plain variables, not conditional hooks.

## EditorContext (XState)

Flat `useEditor()` keys: `primaryBlockId`, `setPrimaryBlockId`, `selectedBlockId`, `setSelectedBlockId(id, blockType)`, `selectedBlockType`, `activeEditorRef`, `send`, `isDragging`, `panelOpen`, `panelWidth`

Derived selectors: `showPageMeta`, `showBlockConfig`, `isTextLikeSelection`

Machine: `src/lib/editor/editorMachine.js`

## Background + contrast (BlockCanvas)

`BlockCanvas` sets `.page-canvas.wysiwyg-surface` with `--wysiwyg-fg` / `--wysiwyg-link` via `useContrastColor`.

## TEXT patch serialization

```js
JSON.stringify(editorState.toJSON()) // in buildInlinePatch — never JSON.stringify(editorState)
```

## Initial-change guard

`TextInlineEditor` uses `ignoreInitialChangeRef` (double-rAF) to suppress the synthetic `onChange`
Lexical fires when seeding initial state. Only real user edits (after the guard clears) trigger a PATCH.
The patch always includes `type: 'TEXT'` (no-op when DB row is already TEXT; migrates legacy HTML/MARKDOWN on first edit).

## Toolbar pill layout (`layout="editor-pill"`)

- `WYSIWYGToolbar` passes `layout` to `ToolbarPlugin`
- Root class: `toolbar toolbar--editor-pill` — `flex-direction: row`, full width
- `toolbar-link-popup` (embed URL) is `position: absolute` above the pill, not a second flex row
- Dashboard chain: `.dashboard-editor-toolbar-row` `flex-shrink: 0`; center group `flex: 1`; toolbar wrapper `width: 100%`

## onChange wiring

```jsx
<TextInlineEditor onChange={(patch) => handleBlockChange(block.id, patch)} />
// patch built via buildInlinePatch('TEXT', payload) inside TextInlineEditor
```
