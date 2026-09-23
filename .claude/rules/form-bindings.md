# Form field bindings (RHF)

## When to use `register`

Use `{...register('fieldName')}` for native `forwardRef` primitives:

- `Input`
- `Textarea`
- `Checkbox` (when used as a native checkbox)

These sync via ref; no Controller boilerplate needed.

## When to use `Controller`

Use `Controller` with explicit `value` / `onChange` / `onBlur` for:

- `Select` (custom wrapper — **never** `{...register('…')}` on Select)
- `MetaAssetPicker`, `TagCombobox`, `TaxonomyTermPicker`, `BackgroundPicker`
- Color inputs (`type="color"`)
- Any third-party or composite widget without a reliable ref bridge

## Canonical Select pattern

Copy from [`SiteForm.jsx`](src/components/SiteForm/SiteForm.jsx):

```jsx
<Controller
  name="visibility"
  control={control}
  render={({ field }) => (
    <Select
      id="page-config-visibility"
      disabled={isSubmitting}
      value={field.value ?? 'public'}
      onChange={field.onChange}
      onBlur={field.onBlur}
    >
      <option value="public">Public</option>
      <option value="private">Private</option>
      <option value="role:member">Cohort</option>
    </Select>
  )}
/>
```

Use `value={field.value ?? ''}` when empty string is the default (e.g. font size "Default" option).

## useFormFlow repeat submit

`useFormFlow` forms support multiple saves. The XState machine accepts `SUBMIT` from `success` (not only `idle`/`error`). Each Save dispatches fresh RHF values via `form.handleSubmit(submit)`.

## Out of scope

- Props-controlled fields outside RHF (e.g. PageMetaForm publish-site `targetSiteId`) — intentional; do not wrap in Controller unless the value moves into the form schema.
