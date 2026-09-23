---
name: image-block-config
description: IMAGE block ConfigPanel — inline ImageConfigPanel, upload/library, alt focus, aria-live
---

# Image Block Config

## Architecture

- **`ImageEditorConfig.jsx`** — thin delegate: `editorMode` → `ImageConfigPanel`, else `ImageRenderer`
- **`ImageConfigPanel.jsx`** — inline panel (not `AssetLibraryDropdown`)
- **`ImageConfigPanel.scss`** — dark tokens only: `--white-ghost-100`, `--black-oil-*` (never `--color-border-primary`)

## ConfigPanel UX

| State | UI |
|-------|-----|
| No `assetId` | Drop zone + Upload + Pick from library |
| Has asset | Preview + Replace with upload / Pick from library / Remove |
| Library open | Inline thumbnail grid below actions (not floating) |
| Alt empty | `aria-live="polite"` hint + `aria-describedby` on alt input |

## APIs

- Upload: `POST /api/assets/upload` (`multipart/form-data`, field `file`)
- Library: `GET /api/assets?kind=IMAGE&status=READY` (returns array with `displayUrl`)

## focusAlt lifecycle

```js
const altRef = useRef(null);
const [focusAlt, setFocusAlt] = useState(false);

useEffect(() => {
  if (focusAlt && altRef.current) {
    altRef.current.focus();
    setFocusAlt(false);
  }
}, [focusAlt]);
```

Fire `setFocusAlt(true)` after upload or library pick.

## asset stub vs assetId

- **`assetId`** — persisted; public `ImageRenderer` resolves via `assetDisplayUrl(block.asset, block.assetId)`
- **`asset` stub** — immediate ConfigPanel preview after pick; API serializes joined asset on reload

## ConfigPanel onChange

Use stable `handleBlockChange` from `ConfigPanel.jsx`. Optimistic patches for `assetId` / `title` / `caption` apply immediately in `EditorShell`.

## Tests

- `src/lib/blocks/plugins/image/ImageConfigPanel.test.jsx`
- `src/lib/blocks/plugins/image/EditorConfig.test.jsx`
