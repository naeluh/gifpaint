# No Raw `useEffect` — Use Event-Driven & Stepped Patterns

## Rule

`useEffect` is a last resort. It is one of the most misused hooks in React and a
leading source of subtle bugs: stale closures, infinite loops, race conditions,
missed dependency declarations, and logic that is nearly impossible to trace.

**Do not reach for `useEffect` to respond to state or prop changes.**
Instead, model your logic as explicit steps or event handlers.

---

## ❌ What NOT to Do

```tsx
// BAD — side effect triggered by state change
useEffect(() => {
  fetchUser(userId);
}, [userId]);

// BAD — derived state via effect
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// BAD — syncing two pieces of state
useEffect(() => {
  if (isOpen) {
    setScrollLocked(true);
  } else {
    setScrollLocked(false);
  }
}, [isOpen]);

// BAD — raw effect in a component body
useEffect(() => {
  const subscription = store.subscribe(handleChange);
  return () => subscription.unsubscribe();
}, []);
```

---

## ✅ What to Do Instead

### 1. Derive values — don't sync them with effects

```tsx
// GOOD — compute directly, no effect needed
const fullName = `${firstName} ${lastName}`;
const isScrollLocked = isOpen;
```

### 2. Trigger logic from events, not state watchers

```tsx
// GOOD — fetch on user action, not on state observation
function handleUserSelect(userId: string) {
  setUserId(userId);
  fetchUser(userId); // called explicitly at the point of change
}
```

### 3. Use stepped / sequential logic in handlers

```tsx
// GOOD — each step is explicit and traceable
async function handleSubmit() {
  setLoading(true);
  const result = await submitForm(formData);
  setResult(result);
  setLoading(false);
  trackAnalytics("form_submitted");
}
```

### 4. Use `useMemo` / `useCallback` for derived or memoized values

```tsx
// GOOD — memoized computation, not a syncing effect
const filteredItems = useMemo(
  () => items.filter((i) => i.active),
  [items]
);
```

---

## When `useEffect` Cannot Be Avoided

Some things genuinely require `useEffect`:

- Subscribing to external stores, WebSockets, or browser APIs
- Timers (`setInterval`, `setTimeout`) that must be tied to the component lifecycle
- Integrating with third-party non-React libraries (e.g. chart libs, maps)
- Measuring DOM elements after render

**In these cases, encapsulate the effect inside a custom hook.** Never write a
raw `useEffect` in a component body for these patterns.

```tsx
// GOOD — side effect isolated in a custom hook
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

// Component stays clean
function MyComponent() {
  const { width } = useWindowSize();
  return <div>Width: {width}</div>;
}
```

```tsx
// GOOD — auth redirect when session becomes ready (useRedirectWhenAuthenticated.js)
function LoginPage() {
  useRedirectWhenAuthenticated('/dashboard');
  // ...
}
```

```tsx
// GOOD — subscription isolated in a hook
function useStoreValue<T>(store: Store<T>) {
  const [value, setValue] = useState<T>(store.getSnapshot());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setValue(store.getSnapshot()));
    return unsubscribe;
  }, [store]);

  return value;
}
```

---

## Decision Tree

```
Need to respond to a change?
│
├─ Is it derived from existing state/props?
│   └─ YES → Compute inline or useMemo. No effect.
│
├─ Is it triggered by a user action?
│   └─ YES → Put the logic in the event handler. No effect.
│
├─ Is it a fetch triggered by navigation / user intent?
│   └─ YES → Use a router loader, React Query, SWR, or call in the handler.
│
└─ Is it a genuine external subscription, timer, or DOM side effect?
    └─ YES → Wrap in a custom hook. useEffect lives there, not in the component.
```

---

## Summary

| Pattern | Verdict |
|---|---|
| `useEffect` to derive state | ❌ Forbidden |
| `useEffect` to sync two states | ❌ Forbidden |
| `useEffect` to fetch on prop change | ❌ Forbidden |
| `useEffect` for subscriptions in a component | ❌ Forbidden |
| Inline derivation / `useMemo` | ✅ Preferred |
| Logic in event handlers | ✅ Preferred |
| `useEffect` inside a custom hook | ✅ Acceptable |
