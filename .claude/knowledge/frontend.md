# Frontend — Accumulated Knowledge

> Living notes for the `/frontend` specialist. Starts mostly empty and fills **with use**:
> every non-obvious lesson (a TanStack Query cache gotcha, a Chakra/theme trap, a hook insight) gets one line here,
> per `.claude/learning/protocol.md`. Authority for patterns stays in `.claude/patterns/frontend.md`.

## Consolidated Principles
- [High] **The snippets in `src/components/ui/*` are the only assembly point for a Chakra v3 compound component.** Product code imports `DialogRoot`/`MenuContent`/`Field`/`Tooltip` from there, never `Dialog.Root` from the package. That is what let the v2→v3 migration keep every wrapper's public props (`AppModal.isOpen`, `ConfirmDialog.isLoading`) while swapping the internals.
- [High] The v2 multi-slot theme configs (menu, dialog, popover, native-select, number-input) were **not** re-declared as v3 `slotRecipes`; their chrome lives on the snippet as style props. One definition point, no config-merge order to reason about. Only single-slot recipes (button, badge, input, textarea) stayed in the theme.

## Component & Hook Patterns
- [High] `useDisclosure()` returns `open` in v3. Destructure `const { open: isOpen, onOpen, onClose } = useDisclosure()` — the alias keeps every call site in the file unchanged and makes the diff one line per hook call. `useConfirm` (ours) still returns `isOpen`; don't "fix" it to match.
- [High] v3 `MenuItem` **requires** a unique `value` prop. A menu that renders but never fires `onClick` is usually a missing `value`.
- [Medium] `PinInput` is controlled by a **string array of exactly `count` entries**. Passing a short array (`"".split("")` → `[]`) leaves the trailing slots `undefined`, which zag stringifies into the value (`"1undefined"`, truncated by maxlength to `"1undef"`). Build it as `Array.from({ length: N }, (_, i) => value[i] ?? "")` and read back `valueAsString`, never `value.join("")`.
- [Medium] v3 `PinInput` renders an extra `hidden-input` for form submission. A test selecting `container.querySelectorAll("input")` picks that one up first — select `input[data-part="input"]` for the visible digit boxes.

## Cache / Query Insights
- (none yet)

## Styling Gotchas
- [High] Static assets in `apps/web/public/` are also referenced by the **backend** by absolute URL (`${FRONTEND_URL}/<file>` — e.g. the email logo in the auth email templates/use-cases). When moving/renaming/deleting a public asset, grep the **whole repo** (`apps/api` included), not just `apps/web` — otherwise transactional emails ship a 404 image undetected by the web build.
- To reference a repo-root `apps/web/assets/*` file (sibling of `src/`, not `public/`): add an `@assets` alias in both `vite.config.ts` (`resolve.alias`) and `tsconfig.json` (`paths`), then `import x from "@assets/foo.svg"` (typed `string` via `vite/client`). For the `index.html` favicon, use a **relative** `./assets/foo.svg` href so Vite fingerprints/bundles it (a leading `/` means `public/` → 404). The browser gets the fingerprinted bundle; server-side emails still need a stable copy in `public/`.
- [High] **`bgGradient` changed shape in v3 and the old value still type-checks.** `bgGradient="linear(135deg, brand.50, accent.50)"` compiles as a plain string and renders nothing. v3 wants `bgGradient="to-br"` + `gradientFrom`/`gradientTo`; radial washes have no shorthand — write `backgroundImage="radial-gradient(...)"`. `tsc` will not find these: grep for them.
- [High] Chakra v3's default `input`/`textarea` recipe ships `outline` with `focusVisibleRing: "inside"` bound to `colorPalette.focusRing` (grey). A custom recipe that overrides only `base` **loses** — the grey ring survives the merge and beats the brand `_focusVisible`. Re-assert the field styles inside `variants.variant.outline` AND set `focusVisibleRing: "none"`.
- [High] v3's built-in `button` recipe defaults to `size: "md"`. The v2 theme defaulted to `sm` via `defaultProps`, so porting the recipe without re-declaring the `size` variants silently grows every unsized `<Button>` in the app.
- [Medium] Chakra v3's preflight resets `ol, ul { list-style: none }` and `* { font: inherit }`. Rich-text/prose surfaces must re-declare `listStyle` and `font-style: italic` in `globalCss` or bullets and `<em>` render flat.
- [Medium] `Icon as={X}` is gone — the glyph is a child. A codemod must alias a **lowercase-named** prop (`icon`) to a capitalized local first, or it emits `<icon />`, which JSX resolves as an intrinsic element.
- [Medium] framer-motion 12 types a cubic-bezier easing as a 4-tuple; a plain `number[]` (or a `readonly` tuple from `as const`) no longer satisfies it. Declare `EASE_ORGANIC: [number, number, number, number]`.
- [Medium] `motion.create(ChakraComponent)` collides with Chakra on `transition` and `style`. Re-type the wrapper (`Omit<BoxProps, keyof MotionProps> & Pick<MotionProps, "initial" | "animate" | "exit" | "transition" | "style">`) **and** narrow the component's own props the same way — otherwise a `...rest` spread widens `transition` right back.

- [Medium] **Renaming a persisted web-storage key is a silent one-time UX regression** (tests always start from empty storage). Read the old key as a `??` fallback (`??`, not `||`, so a stored `"false"` survives) and remove it on the next write — see `SidebarContext` (`sidebar-collapsed` → `@pombo-web:sidebar-collapsed`).

- [High] **A design-token contract spec has one input set per assertion — check each one's scope.** `app/theme/tokenContract.spec.ts` was proven blind three times in the same task, always on the theme-package side: template-literal token names (fixed by keeping literal names in config maps + scanning any `bg|text|border|status|shadow.*` string that is not an i18n key), a source scan rooted only at `apps/web/src` (now also `packages/theme/src`), and a warm-hue check that skipped the recipes (now walks every exported recipe). Also: Chakra's defaultConfig ships `orange`/`yellow` palettes, so "is it a known token?" never implies "is it allowed". Prove every new assertion with a throwaway failing probe.
- [Medium] Chakra v3 resolves `{colors.x.y}` inside any raw CSS value (`backgroundImage="radial-gradient(circle, {colors.bg.glow.primary}, …)"`), and the CSS var flips with `.dark` even inside a Portal. To paint a semantic color as a layer over `bg`, use a one-color gradient: `backgroundImage="linear-gradient({colors.t}, {colors.t})"`.

## Testing Gotchas
- [High] jsdom ships no `PointerEvent`. Chakra v3's press tracking constructs one on blur, so any zag control that is clicked and then loses focus throws out of an event listener: Vitest reports an unhandled error and exits non-zero **even though every assertion passed**. Stub it in `test/setup.ts` (subclassing `MouseEvent` is enough).
- [High] Polyfill `window.matchMedia` as a **plain function**, not a `vi.fn()` — a test calling `vi.clearAllMocks()` wipes the implementation and `next-themes` then reads `.matches` off `undefined`.
- [Medium] v3 dialogs portal in through zag's presence machine, so they land a tick after the render that opened them: use `await screen.findByText(...)`, not `getByText`.

- [Medium] **Visual verification from the desktop app:** the preview process can't read `.env` files (sandboxed), so start the API from Bash (a Node loader that parses `apps/api/.env` + `.env.e2e`, with `WHATSAPP_ENABLED=false` so no real session reconnects) on the e2e ports and only Vite through the preview. Never type credentials into the browser: authenticate with the Playwright `global.setup.ts` storage state and capture pages from a local-only spec (`git`-excluded) in light/dark × desktop/mobile.

## Dead Ends
- [High] Do **not** reach for a generic CRUD layer (`CrudRepository`, `useEntityList`, `useEntityDetail`, `useListPageController`, `ListPageLayout`) in Pombo. It shipped with the template, no module ever used it, and it sat unreachable for the whole life of the app until this migration deleted it. Pombo's domains are not uniform CRUD (`create` returns a one-time secret, `update` is webhook-only, pairing has `connect`/`getQr`). Build the module hook directly on TanStack Query; extract a shared one the day a **second** module genuinely needs the same shape. `cuidda` keeps v3 versions of all of these if one is ever wanted back.
