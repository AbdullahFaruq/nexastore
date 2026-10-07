# Design system

NexaStore's visual identity is **"Brass"**: a precision financial instrument.
Warm-neutral surfaces - ledger paper in light, amber-phosphor terminal in dark -
with a brass accent.

Everything lives in CSS custom properties in `src/app/globals.css` and is
exposed to Tailwind through `@theme inline`, so retheming means editing one
block.

---

## 1. The accent is not a semantic colour

The brand accent is brass. Financial polarity is carried **only** by
`--pos` (green) and `--neg` (red).

This separation is deliberate. In a product where a number going up is
sometimes good (revenue) and sometimes bad (expenses, cost of goods), the brand
colour must not be able to imply either. A brass panel is "this is the important
one", never "this is good".

The `Delta` component takes an `invert` prop for exactly this: the arrow always
points the way the number moved, and the colour reflects whether that movement
is good for the business.

---

## 2. Chart palette

Eight categorical hues, validated in both light and dark modes with the
`validate_palette` tool against this product's own surfaces
(`#fdfcfa` light, `#1a1917` dark).

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | brass | `#b8802e` | `#bd863a` |
| 2 | teal | `#12a08c` | `#17ab95` |
| 3 | violet | `#6a4fd0` | `#9481ea` |
| 4 | coral | `#e2603f` | `#e26c4b` |
| 5 | blue | `#2a78d6` | `#4a92e8` |
| 6 | green | `#3f8f2f` | `#56ab45` |
| 7 | pink | `#dc6f9e` | `#d0729b` |
| 8 | olive | `#7d8f1e` | `#8b9e26` |

All six checks pass in both modes on the adjacent pairlist (stacks, bars,
lines): lightness band, chroma floor, colour-vision-deficiency separation
(worst adjacent pair dE 11.7 light / 9.9 dark, target >= 8), normal-vision floor
(18.5 light / 18.6 dark, floor >= 15), and contrast against the surface.

The first three slots also pass the harder **all-pairs** test in both modes, so
scatter and small-multiple forms cap at three series and fold the rest into
"Other".

**Slot order is the safety mechanism, not a preference.** Do not reorder or
hand-edit these hexes without re-running the validator.

There is also a brass **sequential** ramp (`--seq-1` .. `--seq-7`) used for the
hourly trading heat strip, where hour is ordinal and the colour should read as
intensity.

---

## 3. Status is never colour alone

Every status badge pairs its hue with an **icon and a word**: "Running low" with
a downward trend glyph, "Out of stock" with a struck-through package. That is
what keeps them readable in greyscale, under colour-vision deficiency, and in
forced-colours mode.

The status palette (`--st-good`, `--st-warn`, `--st-serious`, `--st-crit`) is
reserved. A status colour is never reused as a chart series.

---

## 4. Typography

One family: **Geist Sans**, with **Geist Mono** for identifiers - SKUs, order
numbers, keyboard hints. No display face, no serif.

- Hero figures use `letter-spacing: -0.03em` and tabular numerals so a counting
  animation does not make the layout jitter.
- Table columns and axis ticks use `.tnum` (`font-variant-numeric: tabular-nums`)
  so digits align vertically.
- Body copy sits at 13-13.5px with generous line height. Labels at 11-12px.

---

## 5. Structure comes from hairlines, not shadows

Panels are a 1px border and a 9px radius on a surface one step from the page.
Shadows are reserved for things that genuinely float: popovers, dialogs, the
command palette, the mobile cart sheet.

The signature motif is `.tick-rule` - a hairline with measurement ticks, used
between instrument-panel regions in the collapsed sidebar.

Radii: 5px on small controls, 7px standard, 9px on panels, 12-16px on floating
surfaces. Nothing is a pill except badges and progress tracks.

---

## 6. Hierarchy is built by breaking the grid

The dashboard hero is deliberately **not** six identical cards. Net profit gets
its own panel at roughly three times the visual weight - a larger figure, a
margin arc, a revenue-composition bar - and the other six metrics sit beside it
in a compact grid.

A uniform grid of stat cards gives the reader no way to know which number
matters. The asymmetry is the answer to "how is the business doing?" before a
single word is read.

---

## 7. Dark mode is designed, not inverted

The dark palette is its own set of values, not a filter. The base is a warm
near-black (`#141311`), not `#000` and not blue-black; panels lift to `#1a1917`;
the accent lightens to `#d9a04a` so it holds contrast against the dark ground.

Every chart series has its own dark step, validated against the dark surface -
the light hexes would fail the lightness band there.

---

## 8. Motion

Short, eased-out, and always subordinate to the data.

- Hero figures count up once on mount over 700ms with an `easeOutExpo` curve, so
  the number settles rather than spins.
- Panels rise 6px on entry.
- Chart marks animate their draw over ~600ms.
- The sale-completion tick is a single stroke-draw.

Everything is suppressed under `prefers-reduced-motion: reduce`, including the
counting animation, which renders its final value immediately.

---

## 9. Accessibility

- All text colours clear WCAG AA against their surface. Muted ink is 4.6:1
  light, 5.4:1 dark; chart axis ink is separate and used only for chart chrome.
- Focus is a 2px accent outline at 2px offset, never removed.
- Every dialog is a Radix primitive: focus trap, restore, escape, labelled title.
- Tables use real `<table>`, `<th scope="col">` and captions.
- Clickable rows are keyboard-reachable with `tabIndex` and an Enter handler
  alongside the click target.
- A skip-to-content link is the first focusable element.
- Icon-only buttons all carry `aria-label`.

---

## 10. Responsive intent

Mobile is designed, not shrunk.

- The desktop sidebar is replaced by a fixed bottom tab bar with the five things
  a shop floor actually taps, and a raised centre "Sell" action.
- Tables become tappable stacked rows; a horizontally scrolling table on a phone
  is a table nobody reads.
- Dialogs become bottom sheets under 640px.
- The POS hides the global tab bar entirely and gives the bottom of the screen
  to the cart, which peeks as a handle showing the running total and expands to
  a full sheet.

---

## 11. Tokens

| Group | Tokens |
|---|---|
| Surfaces | `--page` `--surface` `--surface-2` `--surface-3` `--inset` |
| Lines | `--line` `--line-strong` `--ring` |
| Ink | `--ink` `--ink-2` `--ink-3` `--ink-invert` |
| Accent | `--accent` `--accent-hover` `--accent-active` `--accent-fg` `--accent-ink` `--accent-soft` `--accent-soft-line` |
| Polarity | `--pos` `--pos-soft` `--neg` `--neg-soft` |
| Status | `--st-good` `--st-warn` `--st-serious` `--st-crit` `--st-neutral` |
| Chart chrome | `--chart-surface` `--grid` `--axis` `--axis-ink` |
| Series | `--s1` .. `--s8` |
| Sequential | `--seq-1` .. `--seq-7` |

To retheme: change the values on `:root` and `.dark`. Re-run the palette
validator if you touch `--s1` .. `--s8`.
