# Cheatsheets

Quick-reference tables for the semantic design tokens in `app/src/css/vars.css`,
Tailwind v4 `@theme` scale tokens, and CSS helper scripts.

## Table of contents

- [Semantic Token Reference](#semantic-token-reference)
- [Tailwind Scale Reference](#tailwind-scale-reference)
- [CSS Helper Scripts Cheatsheet](#css-helper-scripts-cheatsheet)

## Semantic Token Reference

Tokens at `app/src/css/vars.css` follow the `--<category>-<role>` convention so every token groups by its
CSS property domain:

| Category                 | Token                   | Light Mode Value                                              | Dark Mode Value                                               | Typical Usage / Notes                                                      |
| :----------------------- | :---------------------- | :------------------------------------------------------------ | :------------------------------------------------------------ | :------------------------------------------------------------------------- |
| **Surfaces**             | `--surface-page`        | `--nl-50`                                                     | `--nd-850`                                                    | Base page / viewport background (`body`, `.sidebar-layout`)                |
|                          | `--surface-card`        | `--nl-card` (`--nl-50`)                                       | `--nd-950`                                                    | Primary inset content panel, card container, code blocks (`pre`)           |
|                          | `--surface-raised`      | `--nl-raised` (`--nl-50`)                                     | `--nd-800`                                                    | Elevated elements, popovers, dropdown menus, blockquotes, inline `code`    |
|                          | `--surface-translucent` | `color-mix(in oklab, var(--surface-raised) 50%, transparent)` | `color-mix(in oklab, var(--surface-raised) 50%, transparent)` | Semi-transparent cards and toolbars (`my-todos.css`, `todo-list-card.css`) |
|                          | `--avatar-bg`           | `--nl-700`                                                    | `--nd-700`                                                    | User avatar badge background in the sidebar account trigger                |
| **Text / Foreground**    | `--text-primary`        | `--nl-900`                                                    | `--nd-50`                                                     | Default body copy, headings, and form input text                           |
|                          | `--text-muted`          | `--nl-500`                                                    | `--nd-400`                                                    | Secondary captions, icons, placeholders (`text-(--text-muted)`)            |
|                          | `--text-disabled`       | `--nl-300`                                                    | `--nd-600`                                                    | Disabled controls and completed/struck-through todo items                  |
|                          | `--text-on-accent`      | `var(--white)`                                                | `var(--white)`                                                | High-contrast text/icons on `--accent-primary` or `--avatar-bg`            |
| **Borders & Focus**      | `--border-strong`       | `--nl-300`                                                    | `--nd-700`                                                    | Input focus borders, tables, and active dividers                           |
|                          | `--border-subtle`       | `--nl-200`                                                    | `--nd-700`                                                    | Hairline row dividers, card borders, and section separators                |
|                          | `--focus-ring-color`    | `--color-blue-500`                                            | `--color-blue-400`                                            | Focus indicator color (e.g. `border-bottom-color` on focused inputs)       |
|                          | `--focus-ring`          | `2px solid var(--focus-ring-color)`                           | `2px solid var(--focus-ring-color)`                           | Standard `:focus-visible` outline (`outline: var(--focus-ring)`)           |
| **Interactive Controls** | `--control-hover-bg`    | `--nl-200`                                                    | `--nd-800`                                                    | Hover/active background for menu links, icon buttons, and triggers         |
|                          | `--control-hover-text`  | `--nl-950`                                                    | `var(--color-white)`                                          | Hover/active foreground color on interactive controls                      |
| **Accent & Status**      | `--accent-primary`      | `lab(36.9089% 35.0961 -85.6872)`                              | `lab(36.9089% 35.0961 -85.6872)`                              | Brand accent: sidebar logo badge, links, blockquotes, checkboxes           |
|                          | `--status-danger`       | `--color-red-600`                                             | `--color-red-400`                                             | Form errors (`:user-invalid`), delete hover, and sync error dot            |
|                          | `--status-success`      | `--color-green-600`                                           | `--color-green-400`                                           | Sync connected indicator dot (`.sync-status.-is-connected`)                |
| **Radii (Scale)**        | `--radius-control`      | `calc(var(--radius) * 0.6)` (6px)                             | _(same)_                                                      | Compact corner radius for small icon buttons and triggers                  |
|                          | `--radius-item`         | `calc(var(--radius) * 0.8)` (8px)                             | _(same)_                                                      | Menu links, sidebar headers, and submit buttons                            |
|                          | `--radius`              | `0.625rem` (10px)                                             | _(same)_                                                      | Default component corner radius                                            |
|                          | `--radius-panel`        | `calc(var(--radius) * 1.4)` (14px)                            | _(same)_                                                      | Outer panel radius for `.layout-page` and `.login`                         |
| **Motion**               | `--duration-fast`       | `120ms`                                                       | _(same)_                                                      | Fast interactive color/background transitions                              |
|                          | `--duration-normal`     | `150ms`                                                       | _(same)_                                                      | Standard transform, opacity, and validation transitions                    |
| **Primitives**           | `--white` / `--black`   | `#fff` / `#000`                                               | `#fff` / `#000`                                               | Explicit pure white/black for `color-mix()` highlights and shadows         |
|                          | `--spacing`             | `0.25rem` (4px)                                               | _(same)_                                                      | Atomic spacing unit (`calc(var(--spacing) * N)`)                           |
|                          | `--font-sans`           | `"Geist", ui-sans-serif, system-ui, sans-serif`               | _(same)_                                                      | Primary application font family                                            |

## Tailwind Scale Reference

Common scale tokens `app/src/css/theme.css` provided by Tailwind v4 that can be referenced with `var(...)` in scoped component stylesheets:

| Scale             | Tokens                                                                                                    | Example Values                                                 |
| :---------------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Font Size**     | `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`, `--text-3xl`             | `0.75rem`, `0.875rem`, `1rem`, `1.125rem`, `1.25rem`, `1.5rem` |
| **Font Weight**   | `--font-weight-normal`, `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold`            | `400`, `500`, `600`, `700`                                     |
| **Line Height**   | `--leading-tight`, `--leading-snug`, `--leading-normal`, `--leading-relaxed`, `--leading-loose`           | `1.25`, `1.375`, `1.5`, `1.625`, `2`                           |
| **Letter Space**  | `--tracking-tighter`, `--tracking-tight`, `--tracking-normal`, `--tracking-wide`, `--tracking-wider`      | `-0.05em`, `-0.025em`, `0em`, `0.025em`, `0.05em`              |
| **Corner Radius** | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl` | `0.125rem`, `0.25rem`, `0.375rem`, `0.5rem`, `0.75rem`, `1rem` |
| **Box Shadow**    | `--shadow-2xs`, `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`                 | Elevation shadow presets                                       |
| **Containers**    | `--container-xs`, `--container-sm`, `--container-md`, `--container-lg`, `--container-xl`                  | `20rem`, `24rem`, `28rem`, `32rem`, `36rem`                    |

---

## CSS Helper Scripts Cheatsheet

| Command                                                   | Purpose                                                                                             |
| :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `node scripts/toCSS.js <className> "<tailwindUtilities>"` | Compiles a Tailwind utility string into a clean CSS rule for pasting into `@scope` stylesheets.     |
| `npm run lint:styles`                                     | Runs `scripts/checkStyles.js` to enforce `@scope`, semantic tokens, nesting limits, and leaf rules. |
| `npm run lint:styles:baseline`                            | Updates `scripts/checkStyles.baseline.json` after fixing baselined style violations.                |
| `node scripts/findThemeCandidates.js`                     | Scans stylesheets for scale bypasses, repeated themeable values, and unused tokens in `vars.css`.   |
| `node scripts/findThemeCandidates.js --json`              | Outputs theme candidate analysis as structured JSON.                                                |
