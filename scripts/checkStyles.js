import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { transform } from "lightningcss";
import { parseSync } from "oxc-parser";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Deterministic checks for the style conventions in
 * .agents/skills/clean-styles/SKILL.md.
 *
 * CSS is read with lightningcss, TypeScript with oxc-parser and Tailwind class names are
 * resolved with Tailwind's own design system, so there is no hand-written CSS parser.
 *
 * Usage:
 *   node scripts/checkStyles.js                    report violations not in the baseline
 *   node scripts/checkStyles.js --update-baseline  accept the current violations
 *   node scripts/checkStyles.js --all              also list baselined violations
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "app/src");
const GLOBAL_CSS_DIR = join(SRC, "css");
const BASELINE_FILE = join(ROOT, "scripts/checkStyles.baseline.json");

const MAX_NESTING = 3;
const MAX_UTILITIES = 6;

// Elements that may carry layout-neutral, content-level utilities (Tier 3 in the skill).
const LEAF_TAGS = new Set([
  "span",
  "p",
  "small",
  "strong",
  "em",
  "b",
  "i",
  "code",
  "kbd",
  "label",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "svg",
  "img",
  "app-icon",
]);

// Properties that define structure and belong in the scoped stylesheet (Tier 2).
const LAYOUT_PROPERTIES = new Set([
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "gap",
  "row-gap",
  "column-gap",
  "flex",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "grid-template-columns",
  "grid-template-rows",
]);
const LAYOUT_PROPERTY_PREFIXES = ["inset", "margin", "padding", "min-", "max-"];

const PLACEHOLDER = "\u0000";

// Shadows are conventionally black with an alpha, so literal colors are fine there.
const SHADOW_PROPERTIES = new Set(["box-shadow", "text-shadow", "filter", "drop-shadow"]);

/** @typedef {{ file: string, line: number, column: number, rule: string, message: string }} Violation */

const isLayoutProperty = (name) =>
  LAYOUT_PROPERTIES.has(name) || LAYOUT_PROPERTY_PREFIXES.some((p) => name.startsWith(p));

const lineColumn = (code, offset) => {
  const before = code.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
};

/**
 * Loads what the checks need from the project: Tailwind's design system and the set of
 * defined design tokens (custom properties).
 */
export async function loadContext(srcDir = SRC) {
  const cssDir = join(srcDir, "css");
  const base = cssDir + "/";
  const designSystem = await __unstable__loadDesignSystem(
    readFileSync(join(cssDir, "index.css"), "utf8"),
    { base },
  );

  const tokens = new Set([...designSystem.theme.entries()].map(([name]) => name));
  for (const file of listFiles(cssDir, ".css")) {
    transform({
      filename: file,
      code: readFileSync(file),
      errorRecovery: true,
      visitor: { Declaration: { custom: (d) => void tokens.add(d.name) } },
    });
  }

  const propertyCache = new Map();
  /** Returns the CSS property names a Tailwind class sets, or null if it is not a utility. */
  const utilityProperties = (candidate) => {
    if (!propertyCache.has(candidate)) {
      const [css] = designSystem.candidatesToCss([candidate]);
      propertyCache.set(candidate, css ? propertiesOf(css) : null);
    }
    return propertyCache.get(candidate);
  };

  return { tokens, utilityProperties };
}

function propertiesOf(css) {
  const props = new Set();
  transform({
    filename: "utility.css",
    code: Buffer.from(css),
    errorRecovery: true,
    visitor: {
      Declaration(d) {
        // Values containing var() are "unparsed": the real property is in propertyId.
        if (d.property === "custom") props.add(d.value.name);
        else props.add(d.property === "unparsed" ? d.value.propertyId.property : d.property);
      },
    },
  });
  return props;
}

/**
 * Checks one component stylesheet.
 * @returns {Violation[]}
 */
export function checkCss({ file, code, tokens }) {
  /** @type {Violation[]} */
  const violations = [];
  const seen = new Set();
  const report = (loc, rule, message) => {
    const violation = {
      file,
      line: (loc?.line ?? 0) + 1,
      column: (loc?.column ?? 0) || 1,
      rule,
      message,
    };
    // A rule with a selector list would otherwise report the same finding once per selector.
    const key = `${violation.line}:${violation.column}|${rule}|${message}`;
    if (!seen.has(key)) {
      seen.add(key);
      violations.push(violation);
    }
  };

  const localTokens = new Set();
  const usedTokens = [];
  const ruleStack = [];
  let currentProperty = null;
  let sawScope = false;
  const topLevelStyles = [];

  const currentLoc = () => ruleStack.at(-1)?.value?.loc;
  const styleDepth = () => ruleStack.filter((r) => r.type === "style").length;

  transform({
    filename: file,
    code: Buffer.from(code),
    errorRecovery: true,
    visitor: {
      Rule(rule) {
        ruleStack.push(rule);
        if (rule.type === "scope") sawScope = true;
        if (rule.type === "style") {
          if (ruleStack.length === 1) topLevelStyles.push(rule);
          if (styleDepth() > MAX_NESTING) {
            report(
              rule.value.loc,
              "max-nesting",
              `Selector is nested ${styleDepth()} levels deep (max ${MAX_NESTING}). Use a flat semantic class inside @scope.`,
            );
          }
          for (const selector of rule.value.selectors) inspectSelector(selector, rule.value.loc);
        }
      },
      RuleExit() {
        ruleStack.pop();
      },
      Declaration(declaration) {
        currentProperty = declaration.property;
        if (declaration.property === "custom") localTokens.add(declaration.value.name);
      },
      DeclarationExit() {
        currentProperty = null;
      },
      Variable(variable) {
        usedTokens.push({
          name: variable.name.ident,
          hasFallback: Boolean(variable.fallback),
          loc: currentLoc(),
        });
      },
      Color(color) {
        if (color.type === "currentcolor") return;
        if (color.type === "rgb" && color.alpha === 0) return;
        if (SHADOW_PROPERTIES.has(currentProperty)) return;
        report(
          currentLoc(),
          "no-hardcoded-color",
          "Use a semantic color token such as var(--main-text) instead of a literal color.",
        );
      },
    },
  });

  function inspectSelector(selector, loc) {
    selector.forEach((component, i) => {
      // :has(), :is(), :not() and :where() carry their own selector lists.
      for (const nested of component.selectors ?? []) inspectSelector(nested, loc);
      if (component.type === "attribute" && component.name === "data-slot") {
        report(
          loc,
          "no-data-slot-selector",
          "Do not style [data-slot] in CSS. data-slot is only a mount target for TypeScript; use a scoped semantic class (see /clean-styles skill rule 7).",
        );
      }
      if (
        component.type === "pseudo-class" &&
        component.kind === "scope" &&
        selector[i + 1]?.type === "combinator"
      ) {
        report(
          loc,
          "no-scope-child-combinator",
          "Avoid brittle `:scope >` chains. Use a class-based descendant selector.",
        );
      }
    });
  }

  if (!sawScope) {
    report(
      { line: 0, column: 1 },
      "scope-required",
      "Component stylesheets must wrap their rules in @scope.",
    );
  } else {
    for (const rule of topLevelStyles) {
      report(rule.value.loc, "scope-required", "Style rule is outside @scope.");
    }
  }

  for (const { name, hasFallback, loc } of usedTokens) {
    if (/^--n[dl]-/.test(name)) {
      report(loc, "no-palette-token", `Use a semantic token instead of the palette token ${name}.`);
    } else if (
      !hasFallback &&
      !name.startsWith("--tw-") &&
      !tokens.has(name) &&
      !localTokens.has(name)
    ) {
      report(
        loc,
        "undefined-token",
        `var(${name}) is not defined in app/src/css or this stylesheet.`,
      );
    }
  }

  return violations;
}

/**
 * Checks the Lit `html` templates in one TypeScript file.
 * @returns {Violation[]}
 */
export function checkTemplates({ file, code, utilityProperties }) {
  /** @type {Violation[]} */
  const violations = [];
  const { program } = parseSync(file, code);

  for (const template of findHtmlTemplates(program)) {
    const { text, toSourceOffset } = flattenTemplate(template.quasi);
    const report = (index, rule, message) => {
      const { line, column } = lineColumn(code, toSourceOffset(index));
      violations.push({ file, line, column, rule, message });
    };

    let isFirstTag = true;
    for (const tag of scanOpeningTags(text)) {
      const attributes = parseAttributes(tag.attributes);
      const root = isFirstTag;
      isFirstTag = false;

      if (!root && attributes.has("data-component")) {
        report(
          tag.index,
          "data-component-not-root",
          `<${tag.name}> has data-component but is not the template root.`,
        );
      }

      const utilities = (attributes.get("class") ?? "")
        .split(/\s+/)
        .filter((name) => name && !name.includes(PLACEHOLDER))
        .filter((name) => utilityProperties(name));

      if (utilities.length > MAX_UTILITIES) {
        report(
          tag.index,
          "long-class-string",
          `<${tag.name}> has ${utilities.length} Tailwind utilities (max ${MAX_UTILITIES}). Extract a scoped class.`,
        );
      }
      if (!LEAF_TAGS.has(tag.name)) {
        for (const name of utilities) {
          const layout = [...utilityProperties(name)].filter(isLayoutProperty);
          if (layout.length > 0) {
            report(
              tag.index,
              "no-layout-utility",
              `<${tag.name}> uses layout utility "${name}" (${layout.join(", ")}). Move it to the scoped stylesheet.`,
            );
          }
        }
      }
    }
  }

  return violations;
}

function findHtmlTemplates(node, found = []) {
  if (Array.isArray(node)) {
    for (const child of node) findHtmlTemplates(child, found);
  } else if (node && typeof node === "object") {
    if (
      node.type === "TaggedTemplateExpression" &&
      node.tag.type === "Identifier" &&
      node.tag.name === "html"
    ) {
      found.push(node);
    }
    for (const value of Object.values(node)) findHtmlTemplates(value, found);
  }
  return found;
}

/**
 * Joins the static parts of a template, replacing each `${expression}` with a placeholder,
 * and returns a function that maps a position in the joined text back to the source.
 */
function flattenTemplate(quasi) {
  const parts = [];
  let text = "";
  quasi.quasis.forEach((element, i) => {
    // TemplateElement spans include the delimiter (` or }), the raw text starts one later.
    parts.push({ from: text.length, source: element.start + 1 });
    text += element.value.raw;
    if (i < quasi.expressions.length) text += PLACEHOLDER;
  });
  const toSourceOffset = (index) => {
    const part = parts.findLast((p) => p.from <= index);
    return part.source + (index - part.from);
  };
  return { text, toSourceOffset };
}

function* scanOpeningTags(text) {
  const pattern = /<([a-zA-Z][\w-]*)((?:\s[^<>]*)?)\/?>/g;
  for (const match of text.matchAll(pattern)) {
    yield { name: match[1].toLowerCase(), attributes: match[2], index: match.index };
  }
}

function parseAttributes(source) {
  const attributes = new Map();
  const pattern = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes.set(match[1], match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function listFiles(dir, extension) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes("node_modules"))
    .sort();
}

/** Counts violations per `file|rule|message`, so the baseline does not depend on line numbers. */
const keyOf = (v) => `${v.file}|${v.rule}|${v.message}`;

export function splitByBaseline(violations, baseline) {
  const allowed = new Map(Object.entries(baseline));
  const fresh = [];
  const known = [];
  for (const violation of violations) {
    const key = keyOf(violation);
    const remaining = allowed.get(key) ?? 0;
    if (remaining > 0) {
      allowed.set(key, remaining - 1);
      known.push(violation);
    } else {
      fresh.push(violation);
    }
  }
  return { fresh, known };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const context = await loadContext();

  /** @type {Violation[]} */
  const violations = [];
  const rel = (path) => relative(ROOT, path);

  for (const path of listFiles(SRC, ".css")) {
    if (dirname(path) === GLOBAL_CSS_DIR) continue;
    violations.push(
      ...checkCss({ file: rel(path), code: readFileSync(path, "utf8"), tokens: context.tokens }),
    );
  }
  for (const path of listFiles(SRC, ".ts")) {
    if (path.endsWith(".test.ts") || path.endsWith(".d.ts")) continue;
    violations.push(
      ...checkTemplates({
        file: rel(path),
        code: readFileSync(path, "utf8"),
        utilityProperties: context.utilityProperties,
      }),
    );
  }

  if (args.has("--update-baseline")) {
    const counts = {};
    for (const v of violations) counts[keyOf(v)] = (counts[keyOf(v)] ?? 0) + 1;
    writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + "\n");
    console.log(`Baseline updated: ${violations.length} violations recorded.`);
    return;
  }

  const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf8")) : {};
  const { fresh, known } = splitByBaseline(violations, baseline);
  const print = (list, prefix = "") => {
    for (const v of list)
      console.error(`${prefix}${v.file}:${v.line}:${v.column} ${v.rule} ${v.message}`);
  };

  if (args.has("--all")) print(known, "(baseline) ");
  print(fresh);
  console.log(`${fresh.length} new violation(s), ${known.length} in baseline.`);
  if (fresh.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
