---
name: clean-styles
description: 'Refactor and extract bloated utility classes into clean scoped CSS stylesheets using @scope and the toCSS compiler script. Use when refactoring components with long Tailwind class strings, separating container/shell styles from leaf utilities, resolving specificity conflicts, or applying semantic design tokens to CSS.'
---

# Clean Styles: Utility-to-Scoped CSS Factoring

This skill guides coding agents in refactoring web components that combine Tailwind CSS utilities with external scoped stylesheets. It codifies the **"Utility-First Prototyping → Scoped CSS Extraction"** workflow.

## When to Use

Apply this skill when:
- A component's template is cluttered with bloated, multi-line Tailwind `class` strings (e.g., > 5–6 utilities).
- An element uses complex Tailwind variants that simulate CSS selectors (e.g., `group-data-[...]:...`, `peer-hover:...`, `[&>svg]:...`, `data-[state=open]:...`).
- A component has specificity conflicts where a CSS stylesheet overrides inline Tailwind classes (e.g., `.font-medium` overridden by a stylesheet's `font-weight: 400`).
- Hardcoded palette tokens (e.g., `--nd-*` or `--nl-*`) are used instead of semantic design tokens (`light-dark()`, `var(--text-primary)`, `var(--text-muted)`).
- Refactoring pasted component library markup (e.g., shadcn/ui or Tailwind UI) into the project's native `@scope` architecture.

---

## Core Principles

### 1. The "All-or-Nothing" Extraction Rule (No Split-Brain Elements)
Never split the styling of a single element across both Tailwind and a CSS selector:
- **Anti-pattern:** `<div class="font-medium" data-label>` in template, plus `[data-label] { font-weight: 400; color: ... }` in CSS. The stylesheet overrides the Tailwind class due to higher specificity, leaving a dead class in the template.
- **Rule:** If an element is extracted into the stylesheet, move **100%** of its presentation (layout, sizing, typography, colors) to the stylesheet. If it remains an inline utility element, keep it 100% in Tailwind.

### 2. The 3-Level Styling Hierarchy (Shells & Intermediates in CSS, Leaves in Tailwind)
Divide component elements into three strict tiers of responsibility:

- **Tier 1: Root Shell (Scoped CSS — `:scope`):**
  - **Elements:** The outermost mount container (`.sidebar`, `.app-bar`, `.todo-list-card`).
  - **Owned Properties:** Component boundaries, grid/flex root layout, overall dimensions (e.g., `--sidebar-width: 15rem`, `height: 100%`), and component-wide CSS variables.

- **Tier 2: Intermediate Structural Nodes / "In the Middle" (Scoped CSS):**
  - **Elements:** Structural containers, section wrappers, and list items (`.sidebar-header`, `.sidebar-content`, `.sidebar-group`, `.menu-item`, `.menu-toggle`, `.sub-menu`).
  - **Owned Properties:** **All positioning, coordinate contracts, spacing, dimensions, and flow:**
    - Positioning coordinates: `position: relative`, `position: absolute`, `top`, `right`, `bottom`, `left`.
    - Spacing & Flow: Flex/Grid direction, `gap`, and internal `padding`. (Avoid external `margin` on siblings; use parent `gap` instead).
    - Dimensions: `width`, `height`, `min-width: 0`, `flex: 1`, `flex-shrink: 0`.
  - **Strict Rule:** **Never allow layout utility classes (`absolute`, `top-1.5`, `ml-8`, `mt-6`, `w-full`, `h-8`) on intermediate nodes in the template.** These properties define structural relationships and must live in the scoped stylesheet so state transitions (such as `:scope.-is-collapsed`) and responsive media queries work without fighting inline classes.

- **Tier 3: Leaf Elements (Inline Tailwind Utilities):**
  - **Elements:** Terminal content elements only (`<span>`, `<app-icon>`, `<p>`).
  - **Owned Properties:** Local typography and content-contained visuals only (`truncate`, `text-sm`, `text-xs`, `font-medium`, `size-4`, `text-(--text-muted)`).
  - **Strict Rule:** Leaf utilities must never dictate external layout, margins, or positioning relative to siblings.

### 3. Consume Semantic Tokens, Not Palette Tokens
In this project's design system (`app/src/css/vars.css`), tokens follow the `--<category>-<role>` convention:
- **Never hardcode dark or light palette tokens directly** in component stylesheets (e.g., avoid `var(--nd-800)` or `var(--nl-200)`).
- **Always use semantic bridge tokens** that automatically adapt to light and dark modes:
  - Surfaces: `var(--surface-page)`, `var(--surface-card)`, `var(--surface-raised)`, `var(--surface-translucent)`
  - Text: `var(--text-primary)`, `var(--text-muted)`, `var(--text-disabled)`, `var(--text-on-accent)`
  - Borders & Focus: `var(--border-strong)`, `var(--border-subtle)`, `var(--focus-ring-color)`, `var(--focus-ring)`
  - Interactive Controls: `var(--control-hover-bg)`, `var(--control-hover-text)`
  - Accent & Status: `var(--accent-primary)`, `var(--status-danger)`, `var(--status-success)`
  - Spacing & Radii: `var(--spacing)`, `var(--radius)`, `var(--radius-control)`, `var(--radius-item)`, `var(--radius-panel)`
  - Motion: `var(--duration-fast)`, `var(--duration-normal)`

### 4. Resilient Scoping with Native `@scope`
- Scope stylesheets using the component class name and optional component attribute:
  ```css
  @scope (.component-name, [data-component="component-name"]) {
    :scope { ... }
    .component-header { ... }
    .menu-link { ... }
  }
  ```
- **Avoid brittle direct-child chains** like `:scope > [data-sidebar="header"] > div`. Use class-based descendants (`.sidebar-header`, `.sidebar-brand`) so DOM hierarchy adjustments do not break styling.

### 5. Semantic State Modifiers Over Tailwind Variant Soup
Instead of unwieldy Tailwind strings like:
```html
class="data-[state=open]:rotate-90 peer-hover/btn:text-accent group-data-[collapsible=icon]:hidden"
```
Use semantic state classes and ARIA attributes in template and CSS:
- Template: `<button class="menu-toggle ${isOpen ? "-is-open" : ""}" aria-expanded="${isOpen}">`
- CSS:
  ```css
  .menu-toggle {
    transition: transform 150ms ease;
    &.-is-open {
      transform: rotate(90deg);
    }
  }
  ```

### 6. The "2+1" Nesting Limit Rule (Avoid the Pyramid of Doom)
Because `@scope` already isolates styles to the component boundary, **never mirror HTML DOM depth into deep CSS nesting chains**. Keep selectors flat inside `@scope`:
- **Level 1 (Target Elements):** Flat element selectors (`.sidebar-header`, `.menu-link`, `.sub-menu-link`). Do not nest `.sub-menu-link` inside `.sub-menu ul li`—its name is already unique within the scope.
- **Level 2 (Pseudo-states & Modifiers):** Element pseudo-classes and state modifiers using `&` (`&:hover`, `&:focus-visible`, `&.-is-open`, `& > svg`).
- **Level 3 (Max Ceiling / Contextual Overrides):** Parent context modifiers or media queries (e.g., `:scope.-is-collapsed &`, `@media (width < 48rem)`).
- **Level 4+:** 🛑 **Anti-Pattern.** Never write `.sidebar { .content { .group { .menu { .item { .link { ... } } } } } }`. If nesting exceeds 2–3 levels, extract a direct semantic class name instead.

### 7. Component Root Boundaries (`data-component="<name>"`)
In Vanilla JS and Lit mount functions where no framework DevTools component tree exists, place `data-component="<name>"` on the **component's root container**:
```html
<div class="sidebar" data-component="sidebar">
```
- **Why:** 
  - **DevTools Inspection:** Instantly reveals which TypeScript file owns and mounts the DOM sub-tree when scanning the Chrome DevTools Elements panel.
  - **Console Debugging & E2E Testing:** Provides a clean, unambiguous hook (`document.querySelector('[data-component="sidebar"]')`) without coupling to styling classes.
  - **Resilient `@scope` Anchor:** Serves as a dual selector target alongside the class name: `@scope (.sidebar, [data-component="sidebar"])`.
- **Rule:** Use `data-component="<name>"` **only on the root boundary node**. Do not propagate `data-*` attributes down to internal child nodes—use clean, scoped classes (`.sidebar-header`, `.menu-link`) for all internal elements.
- **`data-slot` is for TypeScript only:** A `data-slot="<name>"` attribute marks a mount target that a `.ts` file finds with `querySelector('[data-slot="<name>"]')` (e.g. a layout's content outlet). **Never select it in CSS.** Give the same element a semantic class (`.layout-content`) and style that. Add `data-slot` only when TypeScript actually queries it.

---

## Step-by-Step Refactoring Procedure

### Step 1: Identify Extraction Candidates (The Smell Test)
Review the component template for elements meeting any of these criteria:
- Class string exceeds ~5 utilities or wraps multiple lines.
- Contains arbitrary variants (`group-data-[...]`, `peer-*`, `[&>svg]:...`).
- Contains arbitrary calculations (`w-[calc(...)]`, `left-[calc(...)]`).
- Serves as a structural container (header, menu list, submenu, card body).

### Step 2: Establish the Scoped Stylesheet
Ensure the component has a stylesheet in `app/src/css/<component>.css`:
1. Use `@scope (.<component>, [data-component="<component>"])`.
2. Ensure it is imported in `app/src/css/index.css`.
3. Check `index.css` to confirm there are no duplicate imports.

### Step 3: Extract Containers to Semantic Classes with `toCSS.js`
For each identified container element:
1. Replace the long Tailwind class string with a semantic class name (e.g. `.sidebar-header`, `.menu-item`, `.menu-link`).
2. **Compile utilities automatically with `toCSS.js`**:
   Use the utility script [toCSS.js](./scripts/toCSS.js) (or `node scripts/toCSS.js`) to compile the Tailwind utility string into clean, compiler-verified CSS:
   ```bash
   node scripts/toCSS.js sidebar-header "flex items-center gap-4 p-2"
   ```
   Output:
   ```css
   .sidebar-header {
     display: flex;
     align-items: center;
     gap: calc(var(--spacing, 0.25rem) * 4);
     padding: calc(var(--spacing, 0.25rem) * 2);
   }
   ```
3. Paste the generated CSS into the scoped block in `app/src/**/<component>.css`.
4. Replace hardcoded colors with semantic design tokens (`var(--text-primary)`, `var(--control-hover-bg)`, `var(--border-strong)`).
5. Nest state modifiers (`&.-is-open`) and pseudo-classes (`&:hover`, `&:focus-visible`) following the **2+1 nesting rule**.

### Step 4: Keep Leaf Nodes Clean
Leave leaf elements (`<span>`, `<app-icon>`) with focused Tailwind utilities:
```html
<span class="truncate text-sm font-medium">Local First</span>
<span class="truncate text-xs text-(--text-muted)">Supabase</span>
```

### Step 5: Implement Interactive States and Modifiers
Handle `:hover`, `:active`, `:focus-visible`, and state modifiers (`.-is-open`, `.-is-active`):
- Wire `:hover` and `:focus-visible` states using semantic tokens (`var(--control-hover-bg)`, `var(--focus-ring)`).
- For toggles and accordions, apply a modifier class (`.-is-open`) in JS and animate/rotate in CSS.

### Step 6: Validate Light & Dark Themes and Build
1. Run the deterministic style checker from the repository root and fix every reported violation (or, if a finding is intentional, say so rather than editing the baseline silently):
   ```bash
   npm run lint:styles
   ```
   [checkStyles.js](../../../scripts/checkStyles.js) reads CSS with lightningcss, `html` templates with oxc-parser and resolves Tailwind classes with Tailwind's own design system. It enforces:

   | Rule | Skill rule |
   |---|---|
   | `scope-required` | Every component stylesheet wraps its rules in `@scope` (§4) |
   | `no-palette-token`, `undefined-token`, `no-hardcoded-color` | Semantic tokens only; every `var(--x)` must be defined (§3) |
   | `no-scope-child-combinator` | No brittle `:scope >` chains (§4) |
   | `max-nesting` | At most 3 nested style levels (§6) |
   | `no-layout-utility`, `long-class-string` | No layout utilities on non-leaf elements; at most 6 utilities per element (§2) |
   | `no-data-slot-selector`, `data-component-not-root` | No `[data-slot]` in CSS (it is a TypeScript mount target only); `data-component` only on the template root (§7) |

   Existing violations are recorded in `scripts/checkStyles.baseline.json`, so only new ones fail. When you fix a baselined violation, run `npm run lint:styles:baseline` to shrink the baseline.
2. Inspect the CSS for any raw `--nd-*` or `--nl-*` tokens and replace with semantic tokens.
3. Run the build to verify zero CSS or TypeScript syntax errors:
   ```bash
   npm --prefix app run build
   ```

---

## Before & After Example

### ❌ Before (Bloated, Cluttered, and Conflicted)
```html
<!-- Component template with split-brain styling and giant variant strings -->
<div data-component="sidebar">
  <div data-sidebar="header">
    <a href="#" class="flex items-center">
      <div data-sidebar="icon-container">
        <app-icon name="command" size="16"></app-icon>
      </div>
    </a>
    <div data-sidebar="text-container" class="font-normal">
      <span class="truncate text-sm">Local First</span>
      <span class="truncate text-xs">Supabase</span>
    </div>
  </div>
  <li data-component="menu-item" class="-ml-2 relative">
    <a href="#" class="flex w-full items-center gap-2 px-2 py-1.5">
      <app-icon name="book" size="16"></app-icon>
      <span class="font-normal text-sm">Documentation</span>
    </a>
    <button
      class="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 peer-data-[size=sm]:top-1 data-[state=open]:rotate-90 transition-transform"
      type="button"
    >
      <app-icon name="next" size="16"></app-icon>
    </button>
  </li>
</div>
```

```css
/* Hardcoded dark tokens, direct-child combinator fragility, specificity clash */
@scope ([data-component="sidebar"]) {
  :scope > [data-sidebar="header"] {
    display: flex;
    gap: calc(var(--spacing) * 2.25);
  }
  :scope > [data-sidebar="content"] [data-sidebar="label"] {
    font-weight: 400; /* Overrides template's font-medium class! */
    color: var(--nd-300); /* Broken in light mode */
  }
  :scope > [data-sidebar="content"] [data-component="menu-item"]:hover > a {
    background-color: var(--nd-800); /* Broken in light mode */
  }
}
```

---

###  After (Clean, Structured, and Theme-Resilient)
```typescript
// Component template: Clean containers + concise leaf utilities
<div class="sidebar" data-component="sidebar">
  <div class="sidebar-header">
    <a href="#" class="sidebar-brand">
      <div class="sidebar-brand-icon">
        <app-icon name="command" size="16"></app-icon>
      </div>
    </a>
    <div class="sidebar-brand-text">
      <span class="truncate text-sm font-medium">Local First</span>
      <span class="truncate text-xs text-(--text-muted)">Supabase</span>
    </div>
  </div>

  <li class="menu-item ${isOpen ? "-is-open" : ""}">
    <a href="#" class="menu-link">
      <app-icon name="book" size="16"></app-icon>
      <span class="truncate text-sm">Documentation</span>
    </a>
    <button
      class="menu-toggle ${isOpen ? "-is-open" : ""}"
      type="button"
      aria-label="Toggle submenu"
      aria-expanded="${isOpen}"
      @click=${() => toggleItem(item.title)}
    >
      <app-icon name="next" size="16"></app-icon>
    </button>
  </li>
</div>
```

```css
/* Scoped CSS: Resilient selectors, semantic tokens, encapsulated states */
@scope (.sidebar, [data-component="sidebar"]) {
  :scope {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--text-primary);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: calc(var(--spacing) * 2.25);
  }

  .sidebar-brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius);
    background-color: var(--accent-primary);
    color: var(--text-on-accent);
  }

  .menu-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    border-radius: var(--radius-item);
    color: var(--text-primary);
    text-decoration: none;
    transition: background-color var(--duration-fast) ease, color var(--duration-fast) ease;

    &:hover {
      background-color: var(--control-hover-bg);
      color: var(--control-hover-text);
    }

    &:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
  }

  .menu-toggle {
    position: absolute;
    top: 0.375rem;
    right: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      transform var(--duration-normal) ease,
      color var(--duration-fast) ease,
      background-color var(--duration-fast) ease;

    &:hover {
      color: var(--control-hover-text);
      background-color: var(--control-hover-bg);
    }

    &.-is-open {
      transform: rotate(90deg);
    }
  }
}
```
