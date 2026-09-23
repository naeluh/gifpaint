---
name: lexical-media-config
description: Lexical inline media nodes — config panel, floating toolbar, exportDOM, public parity
---

# Lexical Media Config

## Nodes

| Type | Node | Component | Config fields |
|------|------|-----------|-----------------|
| image | `ImageNode` | `ImageComponent` | source, alt, caption, styles, assetId |
| video | `VideoNode` | `VideoComponent` | source, caption, styles |
| audio | `AudioNode` | `AudioComponent` | source, caption, styles |
| media-embed | `MediaEmbedNode` | `MediaEmbedComponent` | URL (re-parse via `parseEmbedUrl`), caption, styles |
| gallery | `GalleryNode` | `GalleryComponent` | layout, columns, caption, styles, image CRUD |

## Shared helpers

- `src/primitives/WYSIWYG/mediaNodeStyle.js` — `mediaStyleToCss`, `applyMediaStyleAttrs`, `toggleWidthMode`
- `src/primitives/WYSIWYG/useDecoratorNodeSelection.js` — click/select/delete for decorator components
- **Never** add media nodes to `WYSIWYG_EXPORT_MAP` — `removeStylesExportDOM` strips classes/styles

## Config panel

- `LexicalNodeConfigForm` + `MediaStyleFields` + `MediaSourceField`
- Form remount key: `key={\`${node.key}-${mediaNodeDataRevision(data)}\`}` in `ConfigPanel`
- `updateField` warns in dev when setter missing — ship setters before form fields

## Floating toolbar

- `FloatingFormatToolbarPlugin`: `anchorElem` = `.wysiwyg-editor-scroller`, `scrollElem` = `.page-canvas`
- Node mode: type icon, Configure (`SET_PANEL_OPEN`), width toggle, Delete

## Public parity

- `HtmlBlockRenderer` → `sanitizeHtml` + `WYSIWYG-media.scss` + `LexicalGalleryHydrator` for `data-layout="slideshow"`
- Re-save live pages for full parity; archived B2 HTML is frozen

## Insert defaults

- Gallery: `layout: 'grid'`, `columns: 3` via `INSERT_GALLERY_COMMAND`
- Image: pass `assetId` from `handleImageInsert`
