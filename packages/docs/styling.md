# Styling and CSS Architecture

Welcome to the styling guide for Supa App. This project takes a modern, pragmatic
approach to CSS: it combines the rapid prototyping speed of **Tailwind CSS v4** with the
clarity and encapsulation of **scoped CSS stylesheets (`@scope`)** and **semantic design tokens**.

There is no CSS-in-JS runtime, no CSS Modules compiler renaming your classes to random
hashes, and no 15-class Tailwind utility soup cluttering complex component templates.

Instead, the project follows a disciplined architecture:
**"Utility-First Prototyping → Scoped CSS Extraction"**.

Every code snippet in this guide is taken directly from the real source files in `app/src/`.

---

## Table of contents

- [Architecture at a glance](#architecture-at-a-glance)
- [The 3-Level Styling Hierarchy](#the-3-level-styling-hierarchy)
- [Component scoping with native CSS `@scope`](#component-scoping-with-native-css-scope)
- [The Semantic Design Token System](#the-semantic-design-token-system)
- [Comprehensive Semantic Token Reference](#comprehensive-semantic-token-reference)
- [How Theming and `light-dark()` work](#how-theming-and-light-dark-work)
- [Semantic State Modifiers over Tailwind Variant Soup](#semantic-state-modifiers-over-tailwind-variant-soup)
- [Utility Extraction Workflow with `scripts/toCSS.js`](#utility-extraction-workflow-with-scriptstocssjs)
- [Automated Style Checks with `scripts/checkStyles.js`](#automated-style-checks-with-scriptscheckstylesjs)
- [Token Usage and Consistency Audit (Current Status)](#token-usage-and-consistency-audit-current-status)
- [Developer Checklist for New Styles](#developer-checklist-for-new-styles)

## Architecture at a glance

The styling system rests on three pillars:

| Pillar                     | Technology / Pattern                             | Role in this project                                                                                                   |
| :------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Foundations & Tokens**   | CSS Custom Properties (`app/src/css/vars.css`)   | Centralizes theme colors, radii, spacing, and semantic light/dark mode pairs using native `light-dark()`.              |
| **Component Stylesheets**  | Native CSS `@scope` (`*.css` next to components) | Encapsulates component layout, structural nodes, interactive states, and transitions without selector leakage.         |
| **Leaf Content Utilities** | Tailwind CSS v4 (`@import "tailwindcss"`)        | Applies concise, inline typography and icon adjustments on terminal leaf nodes (e.g., `truncate text-sm font-medium`). |

Component stylesheets are co-located with their TypeScript files (for example,
`app/src/lib/shell/sidebar.css` beside `Sidebar.ts`, or `app/src/pages/my-todos/todo-list-card/todo-list-card.css`
beside `TodoListCard.ts`) and imported directly:

```ts
import "./sidebar.css";
```

Only global foundations (`vars.css`, `base.css`, and `tailwind.css`) are loaded in the
top-level entry point `app/src/css/index.css`.

---

## The 3-Level Styling Hierarchy

To keep templates readable and prevent CSS specificity battles, every element in a
component belongs to one of three strict tiers of responsibility:

```text
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Root Shell (Scoped CSS — :scope)                    │
│ .sidebar, .todo-list-card, .login                           │
│ Boundary, outer grid/flex, dimensions, component variables  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Tier 2: Intermediate Structural Nodes (Scoped CSS)          │
│ .sidebar-header, .menu-item, .card-title, .form-field       │
│ Coordinates, positioning, flow, gap, padding, dimensions    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Tier 3: Leaf Content Elements (Inline Tailwind Utilities)   │
│ <span>, <app-icon>, <p>                                     │
│ Typography, truncation, icon sizing, content colors         │
└─────────────────────────────────────────────────────────────┘
```

### Tier 1: Root Shell (Scoped CSS — `:scope`)

- **Elements**: The outermost mount container (`.sidebar`, `.todo-list-card`, `.my-todos`, `.login`).
- **Owned properties**: Outer boundaries, root layout (`display: flex; flex-direction: column;`),
  overall dimensions, and component-scoped variables (e.g., `--sidebar-width: 16rem`).
- **Example** (from `app/src/pages/my-todos/todo-list-card/todo-list-card.css`):

```css
@scope (.todo-list-card, [data-component="todo-list-card"]) {
  :scope {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding-inline: calc(var(--spacing) * 2);
    min-height: calc(var(--spacing) * 40);
    will-change: transform;

    &[hidden] {
      display: none;
    }
  }

  .card-inner {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--spacing) * 3);
    min-height: calc(var(--spacing) * 40);
    padding: calc(var(--spacing) * 4);
    border-radius: var(--radius-xl);
    background-color: var(--surface-translucent);
    color: var(--text-primary);
  }
  /* … */
}
```

### Tier 2: Intermediate Structural Nodes (Scoped CSS)

- **Elements**: Section wrappers, list items, toolbars, buttons, inputs, and toggles
  (`.card-header`, `.sidebar-content`, `.menu-item`, `.menu-toggle`, `.form-input`).
- **Owned properties**: **All positioning, coordinate contracts, spacing, dimensions, and flow**:
  - Positioning: `position: relative`, `position: absolute`, `top`, `right`, `bottom`, `left`.
  - Spacing & Flow: Flex/Grid direction, `gap`, and internal `padding`. (Avoid external `margin`
    on sibling elements; use parent `gap` instead).
  - Dimensions: `width`, `height`, `min-width: 0`, `flex: 1`, `flex-shrink: 0`.
- **Strict Rule**: **Never place layout utility classes (`absolute`, `top-1.5`, `w-full`, `p-4`, `gap-2`)
  on intermediate structural nodes in the template.** These properties define structural contracts
  and must live in the scoped stylesheet so state modifiers (`.-is-open`, `.-is-editing`) and
  responsive media queries can adjust them without fighting inline classes.

### Tier 3: Leaf Elements (Inline Tailwind Utilities)

- **Elements**: Terminal text and icon elements only (`<span>`, `<app-icon>`, `<p>`).
- **Owned properties**: Local typography and content-contained visuals only
  (`truncate`, `text-sm`, `text-xs`, `font-medium`, `size-4`, `text-(--text-muted)`).
- **Strict Rule**: Leaf utilities must never dictate external layout, margins, or positioning
  relative to sibling elements.
- **Example** (from `app/src/lib/shell/Sidebar.ts`):

```html
<div class="sidebar-brand-text">
  <span class="truncate text-sm font-medium">Local First</span>
  <span class="truncate text-xs text-(--text-muted)">Supabase</span>
</div>
```

---

## Component scoping with native CSS `@scope`

Instead of relying on build-time naming transforms (like BEM or CSS Modules), this project
uses the native browser `@scope` rule. It confines all rules within the block to the
matching component subtree.

### Scope selector pattern: Class + `data-component`

Every component stylesheet uses a dual selector targeting both the class name and an explicit
`data-component` attribute:

```css
@scope (.sidebar, [data-component="sidebar"]) {
  :scope {
    /* Styles for the root element */
  }

  .sidebar-header {
    /* Styles for children */
  }
}
```

And in the component template:

```html
<div class="sidebar" data-component="sidebar">
  <div class="sidebar-header">…</div>
</div>
```

Why use both?

1. **Clean DevTools inspection**: When you inspect an element in Chrome DevTools, `data-component="sidebar"`
   instantly tells you which TypeScript file owns and mounts that DOM tree.
2. **Robust debugging & testing**: Tests and console queries can select `document.querySelector('[data-component="sidebar"]')`
   without coupling to presentational classes.
3. **Resilient scoping**: The stylesheet matches whether the container is targeted by class or by attribute.

> **Rule**: Place `data-component="<name>"` **only on the root boundary element**. Child elements
> use clean, scoped classes (`.sidebar-header`, `.menu-link`), never child `data-*` attributes.

### The "2+1" nesting limit rule (Flat selectors inside `@scope`)

Because `@scope` already guarantees isolation from the rest of the application, you do
**not** need to mirror the HTML tree structure into deeply nested CSS rules.

Keep selectors flat inside the scope block following the **2+1 rule**:

- **Level 1 (Target element)**: Flat element selector (`.menu-link`, `.card-title`, `.todo-list`).
- **Level 2 (Pseudo-states & Modifiers)**: Pseudo-classes and state modifiers using `&`
  (`&:hover`, `&:focus-visible`, `&.-is-open`).
- **Level 3 (Ceiling / Context overrides)**: Parent state modifiers or media queries
  (`:scope.-is-editing &`, `:scope.-is-collapsed &`, `@media (width < 48rem)`).
- **Level 4+ (Anti-pattern)**: 🛑 Never write deep descendant chains like
  `.sidebar { .content { .group { .menu { .item { .link { … } } } } } }`. If nesting exceeds
  2–3 levels, give the child element its own semantic class.

---

## The Semantic Design Token System

A core strength of the styling architecture is its separation of **raw palettes** from
**semantic intent**.

Tokens are defined in `app/src/css/vars.css` and use native CSS variables.

### The 3-tier token architecture

```text
1. Primitives (Tailwind v4 @theme)
   --color-newyork-50, --color-newyork-900, --color-red-600, lab(...)
        │
        ▼
2. Scale Bridge Tokens (--nl-* / --nd-*)
   --nl-50: var(--color-newyork-50);    (Neutral Light)
   --nd-850: var(--color-newyork-850);  (Neutral Dark)
        │
        ▼
3. Semantic Bridge Tokens (light-dark())
   --surface-page: light-dark(var(--nl-50), var(--nd-850));
   --text-primary: light-dark(var(--nl-900), var(--nd-50));
```

- **Never consume `--nl-*` or `--nd-*` palette tokens directly in component stylesheets.**
- **Always consume high-level semantic tokens** (`var(--text-primary)`, `var(--surface-page)`,
  `var(--control-hover-bg)`).

Because components consume only semantic tokens, changing a theme or switching color schemes
requires zero changes to component CSS files.

---

## Comprehensive Semantic Token Reference

Tokens in `app/src/css/vars.css` follow a category-first naming convention
(`--<category>-<role>`) so that tokens group naturally by CSS property domain:

### 1. Surface and background tokens (`--surface-*`)

| Token                   | Light mode value                                              | Dark mode value | Purpose / Typical usage                                                               |
| :---------------------- | :------------------------------------------------------------ | :-------------- | :------------------------------------------------------------------------------------ |
| `--surface-page`        | `--nl-50`                                                     | `--nd-850`      | Global page viewport background (`body` and root layout containers).                  |
| `--surface-card`        | `--nl-card` (`--nl-50`)                                       | `--nd-950`      | Primary content surface: main page views, card containers, and code blocks (`pre`).   |
| `--surface-raised`      | `--nl-raised` (`--nl-50`)                                     | `--nd-800`      | Elevated surfaces: dropdown menus (account menu), blockquotes, and inline code pills. |
| `--surface-translucent` | `color-mix(in oklab, var(--surface-raised) 50%, transparent)` | _(same)_        | Semi-transparent card and toolbar surfaces (`my-todos.css`, `todo-list-card.css`).    |
| `--avatar-bg`           | `--nl-700`                                                    | `--nd-700`      | User avatar badge background in the sidebar account trigger.                          |

### 2. Text and foreground tokens (`--text-*`)

| Token              | Light mode value           | Dark mode value            | Purpose / Typical usage                                                          |
| :----------------- | :------------------------- | :------------------------- | :------------------------------------------------------------------------------- |
| `--text-primary`   | `--nl-900` (deep charcoal) | `--nd-50` (soft off-white) | Primary reading text, headings, input text, and default body content.            |
| `--text-muted`     | `--nl-500`                 | `--nd-400`                 | Secondary labels, timestamps, captions, placeholder text, and muted icons.       |
| `--text-disabled`  | `--nl-300`                 | `--nd-600`                 | Disabled buttons, disabled form fields, and completed/struck-through todo items. |
| `--text-on-accent` | `var(--white)`             | `var(--white)`             | High-contrast text and icons on solid accent or avatar backgrounds.              |

### 3. Border and focus tokens (`--border-*`, `--focus-*`)

| Token                | Light mode value                    | Dark mode value    | Purpose / Typical usage                                                                        |
| :------------------- | :---------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------- |
| `--border-strong`    | `--nl-300`                          | `--nd-700`         | Primary borders: container outlines, card borders, input focus states, and table borders.      |
| `--border-subtle`    | `--nl-200`                          | `--nd-700`         | Subtle internal dividers: list item separators, header bottom borders, and menu section lines. |
| `--focus-ring-color` | `--color-blue-500`                  | `--color-blue-400` | High-visibility focus ring color for keyboard navigation (`:focus-visible`).                   |
| `--focus-ring`       | `2px solid var(--focus-ring-color)` | _(same)_           | Standard `:focus-visible` outline shorthand used across interactive controls.                  |

### 4. Interactive control tokens (`--control-*`)

| Token                  | Light mode value | Dark mode value      | Purpose / Typical usage                                                                       |
| :--------------------- | :--------------- | :------------------- | :-------------------------------------------------------------------------------------------- |
| `--control-hover-bg`   | `--nl-200`       | `--nd-800`           | Background when hovered, pressed, or active (navigation links, icon buttons, submit buttons). |
| `--control-hover-text` | `--nl-950`       | `var(--color-white)` | Text and icon color on hovered/active buttons and selected menu items.                        |

### 5. Accent, status, and primitive helper tokens

| Token              | Light mode value                 | Dark mode value     | Purpose / Typical usage                                                                                            |
| :----------------- | :------------------------------- | :------------------ | :----------------------------------------------------------------------------------------------------------------- |
| `--accent-primary` | `lab(36.9089% 35.0961 -85.6872)` | _(same)_            | Brand blue accent: sidebar brand logo badge, checkbox `accent-color`, markdown link color, blockquote callout bar. |
| `--status-danger`  | `--color-red-600`                | `--color-red-400`   | Form validation errors (`:user-invalid`), destructive action hover states, and error status indicators.            |
| `--status-success` | `--color-green-600`              | `--color-green-400` | Successful sync indicator status dot (`.sync-status.-is-connected`).                                               |
| `--white`          | `var(--color-white, #fff)`       | _(same)_            | Explicit pure white primitive (used for `--text-on-accent` and `color-mix()` highlights).                          |
| `--black`          | `var(--color-black, #000)`       | _(same)_            | Explicit pure black primitive (used in `color-mix()` shadow calculations).                                         |

### 6. Geometry, spacing, typography, and motion tokens

| Token               | Value                                           | Purpose / Typical usage                                                                                |
| :------------------ | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `--spacing`         | `0.25rem` (4px)                                 | The atomic spacing unit. Always calculate margins, padding, and gaps using `calc(var(--spacing) * N)`. |
| `--radius`          | `0.625rem` (10px)                               | Default corner radius for inputs, buttons, and inner containers.                                       |
| `--radius-control`  | `calc(var(--radius) * 0.6)` (6px)               | Compact corner radius for small icon buttons and triggers.                                             |
| `--radius-item`     | `calc(var(--radius) * 0.8)` (8px)               | Corner radius for menu links, sidebar headers, and form submit buttons.                                |
| `--radius-panel`    | `calc(var(--radius) * 1.4)` (14px)              | Outer panel corner radius for main layout cards and auth containers.                                   |
| `--radius-sm`       | `0.25rem` (4px, Tailwind `@theme`)              | Small corner radius for theme switcher buttons and inline tags.                                        |
| `--radius-xl`       | `0.75rem` (12px, Tailwind `@theme`)             | Larger corner radius for cards and toolbars.                                                           |
| `--duration-fast`   | `120ms`                                         | Fast interactive color/background transition duration.                                                 |
| `--duration-normal` | `150ms`                                         | Standard transform/opacity/validation transition duration.                                             |
| `--font-sans`       | `"Geist", ui-sans-serif, system-ui, sans-serif` | Application font stack.                                                                                |

---

## How Theming and `light-dark()` work

Modern browsers support the native `light-dark()` function. It evaluates to its first argument
in light mode and its second argument in dark mode, based on the current computed `color-scheme`.

### Zero-FOUC theme initialization

In `app/src/index.html`, a blocking render script inspects `localStorage` and sets the
document's `color-scheme` before the first paint:

```html
<meta name="color-scheme" content="light dark" />
```

In `app/src/css/vars.css`:

```css
:root {
  color-scheme: light dark;

  &:has(> head > meta[name="color-scheme"][content="dark"]) {
    color-scheme: dark;
  }

  &:has(> head > meta[name="color-scheme"][content="light"]) {
    color-scheme: light;
  }

  /* All semantic tokens use light-dark() */
  --surface-page: light-dark(var(--nl-50), var(--nd-850));
  --text-primary: light-dark(var(--nl-900), var(--nd-50));
  /* … */
}
```

When the user toggles the theme in `ThemeSwitcher.ts`, `setColorScheme()` updates the meta tag
and sets `document.documentElement.style.colorScheme = scheme`. Every semantic token across the
entire DOM immediately updates **without requiring a CSS class change or page reload**.

---

## Semantic State Modifiers over Tailwind Variant Soup

A common pitfall with utility-first CSS is "variant soup"—class strings filled with complex
state simulators like:

```html
<!-- ❌ Hard to read, brittle, and difficult to coordinate in tests -->
<button
  class="data-[state=open]:rotate-90 peer-hover/btn:text-accent group-data-[collapsible=icon]:hidden"
></button>
```

In this project, components use **clean semantic state modifier classes** (`.-is-open`,
`.-is-active`, `.-is-editing`, `.-is-done`, `.-is-connected`):

### Real examples from the app

1. **Collapsible toggle rotation** (`app/src/lib/shell/sidebar.css`):

```html
<!-- Template -->
<button class="menu-toggle ${isOpen ? "-is-open" : ""}" aria-expanded="${isOpen}">
  <app-icon name="next" size="16"></app-icon>
</button>
```

```css
/* Scoped CSS */
.menu-toggle {
  transition:
    transform var(--duration-normal) ease,
    color var(--duration-fast) ease;

  &.-is-open {
    transform: rotate(90deg);
  }
}
```

2. **Inline card editing toggle** (`app/src/pages/my-todos/todo-list-card/todo-list-card.css`):

```css
.card-title {
  :scope.-is-editing & {
    display: none;
  }
}

.card-title-input {
  display: none;

  :scope.-is-editing & {
    display: block;
  }
}

.card-delete-button {
  display: none;

  :scope.-is-editing & {
    display: flex;
  }
}
```

3. **Modern form validation with `:user-invalid` and `:has()`** (`app/src/pages/auth/login.css`):

```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);

  /* Highlight label when the contained input is invalid AFTER user interaction */
  &:has(.form-input:user-invalid) .form-label {
    color: var(--status-danger);
  }
}

.form-input {
  /* Only shows error styling once the user has interacted with the field */
  &:user-invalid,
  &:user-invalid:focus-visible {
    border-bottom-color: var(--status-danger);
    color: var(--status-danger);
  }
}
```

Notice the use of `:user-invalid` instead of `:invalid`: it prevents red error borders
from appearing on fresh, untouched forms before the user even types!

---

## Utility Extraction Workflow with `scripts/toCSS.js`

When building a new component or prototyping a feature, it is completely normal to start
with inline Tailwind classes. Once the component structure stabilizes, use the repository's
`toCSS.js` script to compile those utilities into clean, scoped CSS.

### Step 1: Identify extraction candidates (The Smell Test)

Extract an element to the scoped stylesheet if:

- Its class string exceeds 5–6 utilities or wraps across multiple lines.
- It is a structural container (header, card shell, menu item, toolbar).
- It handles complex responsive rules or hover/focus/active state transitions.

### Step 2: Compile utilities with `scripts/toCSS.js`

Run the compilation script from the repository root:

```sh
node scripts/toCSS.js card-header "flex items-center gap-2 min-h-8"
```

The script uses `@tailwindcss/node` to generate clean CSS:

```css
.card-header {
  display: flex;
  min-height: calc(var(--spacing) * 8);
  align-items: center;
  gap: calc(var(--spacing) * 2);
}
```

### Step 3: Replace raw values with semantic tokens

Paste the generated output into your scoped component stylesheet and replace raw colors
with semantic tokens:

- Replace raw colors with `var(--text-primary)`, `var(--border-strong)`, `var(--control-hover-bg)`.
- Replace raw radius values with `var(--radius)`, `var(--radius-control)`, `var(--radius-item)`, or `var(--radius-panel)`.
- Keep spacing aligned to `calc(var(--spacing) * N)`.

### Step 4: Keep leaf elements in Tailwind

Leave terminal content elements (`<span>`, `<app-icon>`) with focused utilities:

```html
<span class="truncate text-sm font-medium">My List</span>
```

---

## Automated Style Checks with `scripts/checkStyles.js`

The conventions above are checked by `npm run lint:styles` (part of `npm run check` and CI):

- **Component CSS** (`app/src/**/*.css` except `app/src/css/`): `@scope` is present, no
  palette tokens or literal colors (shadows excepted), every `var(--token)` is defined,
  no `:scope >` chains, nesting stays within 3 levels, and no `[data-slot]` selectors
  (`data-slot` is only a mount target for `querySelector` in TypeScript, so style a
  semantic class instead).
- **`html` templates in `.ts` files**: no layout utilities (position, inset, margin,
  padding, size, gap, flex or grid structure) on non-leaf elements, at most 6 utilities per
  element, and `data-component` only on the root element.
- Tailwind classes are resolved with Tailwind's design system, so variants (`md:p-2`) and
  arbitrary values (`w-[12rem]`) are understood. Classes with `${...}` parts are skipped.

Violations that existed when the checker was introduced are listed in
`scripts/checkStyles.baseline.json`. Only new violations fail. After fixing old ones, run
`npm run lint:styles:baseline` to shrink the baseline. Its dependencies (`@tailwindcss/node`,
`lightningcss`, `oxc-parser`) are pinned because the design system API is marked unstable.

For ad-hoc theme discovery outside CI, run `node scripts/findThemeCandidates.js` (or
`node scripts/findThemeCandidates.js --json`). It scans component stylesheets for literal
values that bypass existing `@theme` / `vars.css` scale tokens, repeated derived expressions
(`calc()`, `color-mix()`), high-frequency themeable property values, and unused tokens in
`app/src/css/vars.css`.

---

## Token Usage and Consistency Audit (Current Status)

Because the styling system is a work in progress, an automated audit of the codebase was
conducted to measure consistency and document current patterns:

### What is working well ✅

1. **Zero direct palette leakage**: Not a single component stylesheet consumes raw `--nl-*`
   or `--nd-*` palette tokens. All components strictly consume high-level semantic tokens.
2. **Consistent spacing grid**: All layout containers consistently calculate coordinates and
   dimensions using multiples of `--spacing` (`calc(var(--spacing) * 2)`, `calc(var(--spacing) * 4)`).
3. **Robust keyboard accessibility**: Focusable controls across all stylesheets consistently
   apply `outline: var(--focus-ring); outline-offset: 2px;` on `:focus-visible`.
4. **Scoped CSS coverage**: Shell elements, auth pages, docs viewers, and todo lists all use
   native `@scope` isolation.

### Areas being standardized (Work-in-progress) ⚠️

As you maintain and add components, keep these refinements in mind:

- **Shadow definitions**: `app/src/lib/shell/sidebar-layout.css` currently uses raw `rgb(0 0 0 / 0.1)`
  for shadows. Prefer `color-mix(in srgb, var(--black) 12%, transparent)` (as seen in `sidebar.css`)
  or Tailwind's `--shadow-sm` / `--shadow-lg` tokens.
- **Typography scaling**: Some component stylesheets have direct pixel/rem values like
  `font-size: 0.875rem` (which corresponds to `var(--text-sm)`). Prefer Tailwind's font-size
  tokens or inline leaf utilities.
- **Dual scope selector**: Ensure all component stylesheets include both the class and
  `[data-component]` attribute in their scope definition:
  `@scope (.my-component, [data-component="my-component"])`.

---

## Developer Checklist for New Styles

Before committing a new component or modifying existing styles, verify:

- [ ] **Styles co-located**: Is the CSS file beside the component and imported with `import "./<name>.css"`?
- [ ] **Dual scope selector**: Does the stylesheet start with `@scope (.<name>, [data-component="<name>"])`?
- [ ] **Root boundary attribute**: Does the template's root container have both `class="<name>"` and `data-component="<name>"`?
- [ ] **All-or-Nothing rule**: Did you avoid splitting styles between Tailwind and CSS on the same element?
- [ ] **Semantic tokens used**: Did you use `var(--text-primary)`, `var(--surface-page)`, etc., and avoid raw `--nl-*` / `--nd-*` or hex colors?
- [ ] **Spacing on the grid**: Are paddings and gaps calculated with `calc(var(--spacing) * N)`?
- [ ] **Focus rings**: Do interactive elements have `:focus-visible { outline: var(--focus-ring); }`?
- [ ] **Flat selectors**: Did you follow the 2+1 nesting rule inside `@scope` and avoid deep DOM nesting chains?
- [ ] **Clean formatting**: Did you run `npm run fmt` (or `npx oxfmt`) on the stylesheet?
