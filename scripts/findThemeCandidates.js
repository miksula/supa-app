import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { transform } from "lightningcss";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Heuristic analyzer that scans component stylesheets and templates to find
 * candidates for design system tokens in `app/src/css/vars.css`.
 *
 * Heuristics implemented:
 * 1. Scale bypasses: literal values in component CSS that already have an exact
 *    token in `@theme` or `vars.css` (e.g. `0.875rem` -> `var(--text-sm)`).
 * 2. Derived expressions: non-spacing `calc(var(--token) ...)` and `color-mix(...)`
 *    expressions repeated across multiple files or rules.
 * 3. Repeated themeable literals: values in theme-relevant property categories
 *    (radii, typography, motion, shadows, borders, control sizes) weighted by
 *    cross-file dispersion and occurrence count.
 * 4. Unused project tokens: semantic tokens defined in `app/src/css/vars.css`
 *    that are never referenced in any stylesheet or template.
 *
 * Usage:
 *   node scripts/findThemeCandidates.js
 *   node scripts/findThemeCandidates.js --json
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "app/src");
const GLOBAL_CSS_DIR = join(SRC, "css");

/**
 * Property categories that carry theme intent, mapped to `{ category, weight, tokenPrefix }`.
 * Structural layout properties (`display`, `position`, `flex`, `grid`, `overflow`, etc.)
 * are intentionally omitted so structural resets never pollute candidate lists.
 */
const THEMEABLE_PROPERTIES = new Map([
  ["border-radius", { category: "radius", weight: 4, tokenPrefix: "--radius" }],
  ["border-top-left-radius", { category: "radius", weight: 4, tokenPrefix: "--radius" }],
  ["border-top-right-radius", { category: "radius", weight: 4, tokenPrefix: "--radius" }],
  ["border-bottom-left-radius", { category: "radius", weight: 4, tokenPrefix: "--radius" }],
  ["border-bottom-right-radius", { category: "radius", weight: 4, tokenPrefix: "--radius" }],
  ["font-size", { category: "typography-size", weight: 4, tokenPrefix: "--text-" }],
  ["font-weight", { category: "typography-weight", weight: 4, tokenPrefix: "--font-weight-" }],
  ["line-height", { category: "typography-leading", weight: 3, tokenPrefix: "--leading-" }],
  ["letter-spacing", { category: "typography-tracking", weight: 3, tokenPrefix: "--tracking-" }],
  ["font-family", { category: "typography-font", weight: 4, tokenPrefix: "--font-" }],
  ["box-shadow", { category: "shadow", weight: 4, tokenPrefix: "--shadow-" }],
  ["text-shadow", { category: "shadow", weight: 3, tokenPrefix: "--text-shadow-" }],
  ["outline", { category: "focus", weight: 4, tokenPrefix: "--focus-ring" }],
  ["outline-offset", { category: "focus", weight: 2, tokenPrefix: "--focus-" }],
  ["transition", { category: "motion", weight: 3, tokenPrefix: "--duration-" }],
  ["transition-duration", { category: "motion", weight: 4, tokenPrefix: "--duration-" }],
  ["animation-duration", { category: "motion", weight: 4, tokenPrefix: "--duration-" }],
  ["color", { category: "color-text", weight: 4, tokenPrefix: "--text-" }],
  ["background", { category: "color-surface", weight: 4, tokenPrefix: "--surface-" }],
  ["background-color", { category: "color-surface", weight: 4, tokenPrefix: "--surface-" }],
  ["border-color", { category: "color-border", weight: 4, tokenPrefix: "--border-" }],
  ["border-bottom-color", { category: "color-border", weight: 4, tokenPrefix: "--border-" }],
  ["border-top-color", { category: "color-border", weight: 4, tokenPrefix: "--border-" }],
  ["border-left-color", { category: "color-border", weight: 4, tokenPrefix: "--border-" }],
  ["border-right-color", { category: "color-border", weight: 4, tokenPrefix: "--border-" }],
  ["border", { category: "border", weight: 3, tokenPrefix: "--border-" }],
  ["border-top", { category: "border", weight: 3, tokenPrefix: "--border-" }],
  ["border-bottom", { category: "border", weight: 3, tokenPrefix: "--border-" }],
  ["border-left", { category: "border", weight: 3, tokenPrefix: "--border-" }],
  ["border-right", { category: "border", weight: 3, tokenPrefix: "--border-" }],
  ["accent-color", { category: "color-accent", weight: 4, tokenPrefix: "--accent-" }],
  ["z-index", { category: "elevation", weight: 2, tokenPrefix: "--z-" }],
  ["max-width", { category: "container", weight: 2, tokenPrefix: "--container-" }],
]);

const TRIVIAL_VALUES = new Set([
  "0",
  "0px",
  "0rem",
  "0%",
  "100%",
  "100vw",
  "100vh",
  "100dvh",
  "auto",
  "none",
  "normal",
  "inherit",
  "initial",
  "unset",
  "revert",
  "transparent",
  "currentcolor",
  "1px",
  "calc(infinity * 1px)",
]);

const isPureTokenReference = (value) => /^var\(--[\w-]+\)$/.test(value);
const isSpacingMultiple = (value) =>
  /^calc\(var\(--spacing(?:,[^)]+)?\)\s*\*\s*-?[\d.]+\)$/.test(value);
const isDerivedTokenExpression = (value) =>
  !isSpacingMultiple(value) &&
  (/(?:calc|min|max|clamp)\([^)]*var\(--/.test(value) || /color-mix\([^)]*var\(--/.test(value));

/**
 * Normalizes a CSS declaration value with lightningcss so equivalent representations
 * (`.875rem` vs `0.875rem`, whitespace, color-mix formatting) compare equal.
 */
export function normalizeCssValue(property, rawValue) {
  const collapsed = rawValue.replace(/\s+/g, " ").trim();
  if (!collapsed) return collapsed;
  try {
    const out = transform({
      filename: "normalize.css",
      code: Buffer.from(`.x { ${property}: ${collapsed}; }`),
      errorRecovery: true,
    }).code.toString();
    const match = out.match(/\.x\s*\{\s*[\w-]+\s*:\s*([\s\S]*?);?\s*\}/);
    const serialized = match ? match[1] : collapsed;
    return serialized
      .replace(/\s+/g, " ")
      .replace(/(?<![\d.])\.(\d)/g, "0.$1")
      .trim();
  } catch {
    return collapsed.replace(/(?<![\d.])\.(\d)/g, "0.$1");
  }
}

/**
 * Extracts CSS declarations with file and 1-based line numbers, omitting comments,
 * custom property definitions, and @keyframes blocks.
 */
export function extractDeclarations(file, code) {
  const declarations = [];
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const pattern = /(?:^|[;{])\s*([a-z][a-z0-9-]*)\s*:\s*([^;{}]+?)\s*(?=;|\})/gi;

  for (const match of stripped.matchAll(pattern)) {
    const property = match[1].toLowerCase();
    const rawValue = match[2].trim();
    if (property === "result") continue;
    const propOffset = match.index + match[0].indexOf(match[1]);
    const line = stripped.slice(0, propOffset).split("\n").length;
    declarations.push({
      file,
      line,
      property,
      rawValue,
      value: normalizeCssValue(property, rawValue),
    });
  }

  return declarations;
}

/**
 * Builds a lookup table mapping `(tokenPrefix, normalizedValue)` -> `tokenName`
 * from Tailwind's `@theme` and `app/src/css/vars.css`.
 */
async function loadScaleCatalog(srcDir = SRC) {
  const cssDir = join(srcDir, "css");
  const designSystem = await __unstable__loadDesignSystem(
    readFileSync(join(cssDir, "index.css"), "utf8"),
    { base: cssDir + "/" },
  );

  const scaleByPrefix = new Map([
    ["--text-", "font-size"],
    ["--font-weight-", "font-weight"],
    ["--leading-", "line-height"],
    ["--tracking-", "letter-spacing"],
    ["--radius", "border-radius"],
    ["--shadow-", "box-shadow"],
    ["--text-shadow-", "text-shadow"],
    ["--container-", "max-width"],
    ["--duration-", "transition-duration"],
  ]);

  /** @type {Map<string, string>} key: `${prefix}|${normalizedValue}` -> tokenName */
  const catalog = new Map();

  const registerToken = (name, rawVal) => {
    if (!rawVal || name.endsWith("--line-height")) return;
    for (const [prefix, sampleProp] of scaleByPrefix) {
      if (name === prefix || name.startsWith(prefix)) {
        const normalized = normalizeCssValue(sampleProp, rawVal);
        const key = `${prefix}|${normalized}`;
        if (!catalog.has(key)) catalog.set(key, name);
      }
    }
  };

  for (const [name, entry] of designSystem.theme.entries()) {
    registerToken(name, entry?.value);
  }

  const varsCode = readFileSync(join(cssDir, "vars.css"), "utf8");
  const projectTokens = new Set();
  for (const match of varsCode.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const [, name, rawVal] = match;
    registerToken(name, rawVal.trim());
    if (!/^--n[dl]-/.test(name)) {
      projectTokens.add(name);
    }
  }

  return { catalog, projectTokens };
}

/**
 * Scores a candidate group according to cross-file dispersion, total count,
 * property theme weight, and whether it is a derived expression.
 */
export function scoreCandidate({ distinctFiles, totalOccurrences, weight, derived }) {
  return distinctFiles * 3 + totalOccurrences + weight + (derived ? 4 : 0);
}

export async function analyzeThemeCandidates(srcDir = SRC) {
  const { catalog, projectTokens } = await loadScaleCatalog(srcDir);
  const referencedTokens = new Set();

  // Collect token references across global CSS, component CSS, and TS templates.
  for (const file of listFiles(srcDir, ".css")) {
    const code = readFileSync(file, "utf8");
    transform({
      filename: file,
      code: Buffer.from(code),
      errorRecovery: true,
      visitor: {
        Variable(v) {
          referencedTokens.add(v.name.ident);
        },
      },
    });
  }
  for (const file of listFiles(srcDir, ".ts")) {
    if (file.endsWith(".test.ts") || file.endsWith(".d.ts")) continue;
    const code = readFileSync(file, "utf8");
    for (const match of code.matchAll(/--[a-z0-9-]+/gi)) {
      referencedTokens.add(match[0]);
    }
  }

  const scaleBypasses = [];
  /** @type {Map<string, { category: string, property: string, value: string, derived: boolean, weight: number, locations: { file: string, line: number, property: string }[] }>} */
  const groups = new Map();

  for (const fullPath of listFiles(srcDir, ".css")) {
    if (dirname(fullPath) === GLOBAL_CSS_DIR) continue;
    const file = relative(ROOT, fullPath);
    const code = readFileSync(fullPath, "utf8");

    for (const decl of extractDeclarations(file, code)) {
      const meta = THEMEABLE_PROPERTIES.get(decl.property);
      const derived = isDerivedTokenExpression(decl.value);
      if (!meta && !derived) continue;

      if (
        TRIVIAL_VALUES.has(decl.value.toLowerCase()) ||
        isPureTokenReference(decl.value) ||
        isSpacingMultiple(decl.value)
      ) {
        continue;
      }

      // Heuristic 1: Does an exact token already exist for this property's scale?
      if (meta) {
        const existingToken = catalog.get(`${meta.tokenPrefix}|${decl.value}`);
        if (existingToken) {
          scaleBypasses.push({
            file: decl.file,
            line: decl.line,
            property: decl.property,
            value: decl.rawValue,
            suggestedToken: `var(${existingToken})`,
          });
          continue;
        }
      }

      // Heuristic 2 & 3: Group by category + normalized value.
      const category = meta?.category ?? "derived-expression";
      const weight = meta?.weight ?? 3;
      const key = `${category}|${decl.value}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          category,
          property: decl.property,
          value: decl.value,
          derived,
          weight,
          locations: [],
        };
        groups.set(key, group);
      }
      group.locations.push({ file: decl.file, line: decl.line, property: decl.property });
    }
  }

  const candidates = [];
  for (const group of groups.values()) {
    const distinctFiles = new Set(group.locations.map((l) => l.file)).size;
    const totalOccurrences = group.locations.length;

    // Require cross-file usage (2+ files & 3+ occurrences, or 2+ files for derived expressions)
    // or high single-file repetition (4+ occurrences).
    const qualifies =
      (group.derived && (distinctFiles >= 2 || totalOccurrences >= 3)) ||
      (distinctFiles >= 2 && totalOccurrences >= 3) ||
      totalOccurrences >= 4;

    if (!qualifies) continue;

    candidates.push({
      category: group.category,
      value: group.value,
      derived: group.derived,
      distinctFiles,
      totalOccurrences,
      score: scoreCandidate({
        distinctFiles,
        totalOccurrences,
        weight: group.weight,
        derived: group.derived,
      }),
      locations: group.locations,
    });
  }

  candidates.sort((a, b) => b.score - a.score || b.distinctFiles - a.distinctFiles);

  const unusedTokens = [...projectTokens].filter((t) => !referencedTokens.has(t)).sort();

  return { scaleBypasses, candidates, unusedTokens };
}

function listFiles(dir, extension) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes("node_modules"))
    .sort();
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = await analyzeThemeCandidates();

  if (args.has("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("=== 1. Scale Bypasses (Existing Token Available) ===");
  if (result.scaleBypasses.length === 0) {
    console.log("  None found.");
  } else {
    for (const item of result.scaleBypasses) {
      console.log(
        `  ${item.file}:${item.line}  ${item.property}: ${item.value}  ->  ${item.suggestedToken}`,
      );
    }
  }

  console.log("\n=== 2. Theme Token Candidates (Ranked by Heuristic Score) ===");
  if (result.candidates.length === 0) {
    console.log("  None found.");
  } else {
    for (const c of result.candidates) {
      const files = [...new Set(c.locations.map((l) => `${l.file}:${l.line}`))].join(", ");
      const tag = c.derived ? " [derived]" : "";
      console.log(
        `  [score ${c.score}] (${c.category}${tag}) ${c.value} — ${c.totalOccurrences}x across ${c.distinctFiles} file(s)`,
      );
      console.log(`    at ${files}`);
    }
  }

  console.log("\n=== 3. Unused Project Tokens in app/src/css/vars.css ===");
  if (result.unusedTokens.length === 0) {
    console.log("  None — all semantic tokens in vars.css are referenced.");
  } else {
    for (const token of result.unusedTokens) {
      console.log(`  ${token}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
