import { beforeAll, describe, expect, it } from "vitest";
import { checkCss, checkTemplates, loadContext, splitByBaseline } from "./checkStyles.js";

let context;

beforeAll(async () => {
  context = await loadContext();
});

const css = (code) => checkCss({ file: "x.css", code, tokens: context.tokens });
const ts = (code) =>
  checkTemplates({ file: "x.ts", code, utilityProperties: context.utilityProperties });
const rules = (violations) => violations.map((v) => v.rule);

describe("checkCss", () => {
  it("accepts a clean scoped stylesheet", () => {
    const violations = css(`
      @scope (.card, [data-component="card"]) {
        :scope { color: var(--text-primary); background: var(--surface-card); border-radius: var(--radius); }
        .card-title { color: var(--text-muted); &:hover { color: var(--control-hover-text); } }
        .card-shadow { box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); border-color: currentcolor; background: transparent; }
      }
    `);
    expect(violations).toEqual([]);
  });

  it("reports a stylesheet without @scope", () => {
    expect(rules(css(`.card { color: var(--text-primary); }`))).toContain("scope-required");
  });

  it("reports style rules outside @scope", () => {
    const violations = css(`
      @scope (.card) { :scope { color: var(--text-primary); } }
      .stray { color: var(--text-primary); }
    `);
    expect(violations).toMatchObject([
      { rule: "scope-required", line: 3, message: "Style rule is outside @scope." },
    ]);
  });

  it("reports palette tokens", () => {
    const violations = css(
      `@scope (.card) { :scope { color: var(--nd-300); background: var(--nl-50); } }`,
    );
    expect(rules(violations)).toEqual(["no-palette-token", "no-palette-token"]);
    expect(violations[0].message).toContain("--nd-300");
  });

  it("reports undefined tokens but not defined, local, fallback or Tailwind ones", () => {
    const violations = css(`
      @scope (.card) {
        :scope {
          --local: 1px;
          padding: var(--local);
          color: var(--does-not-exist);
          margin: var(--also-missing, 4px);
          border-color: var(--border-strong);
          gap: var(--spacing);
          rotate: var(--tw-rotate-x);
        }
      }
    `);
    expect(violations).toMatchObject([
      { rule: "undefined-token", message: expect.stringContaining("--does-not-exist") },
    ]);
  });

  it("reports literal colors once per rule", () => {
    const violations = css(
      `@scope (.card) {\n  :scope { color: #ff0000; background: rgb(10 20 30); }\n  .b { color: hsl(0 0% 50%); }\n}`,
    );
    expect(violations).toMatchObject([
      { rule: "no-hardcoded-color", line: 2 },
      { rule: "no-hardcoded-color", line: 3 },
    ]);
  });

  it("reports :scope child combinators with the rule's line", () => {
    const violations = css(
      `@scope (.card) {\n  :scope > .header { color: var(--text-primary); }\n}`,
    );
    expect(violations).toMatchObject([{ rule: "no-scope-child-combinator", line: 2 }]);
  });

  it("reports [data-slot] selectors in all forms", () => {
    const violations = css(`@scope (.card) {
  [data-slot="header"] { color: var(--text-primary); }
  .a[data-slot="b"] .c { color: var(--text-primary); }
  &:has([data-slot]) { color: var(--text-primary); }
}`);
    expect(violations).toMatchObject([
      { rule: "no-data-slot-selector", line: 2 },
      { rule: "no-data-slot-selector", line: 3 },
      { rule: "no-data-slot-selector", line: 4 },
    ]);
  });

  it("reports selectors nested deeper than 3 levels", () => {
    const tooDeep = css(`
      @scope (.a) { .l1 { .l2 { .l3 { .l4 { color: var(--text-primary); } } } } }
    `);
    expect(rules(tooDeep)).toEqual(["max-nesting"]);

    const allowed = css(`
      @scope (.a) { .l1 { &:hover { :scope.-is-open & { color: var(--text-primary); } } } }
    `);
    expect(allowed).toEqual([]);
  });
});

describe("checkTemplates", () => {
  it("accepts a clean template", () => {
    const violations = ts(`
      export const View = () => html\`
        <div class="card" data-component="card">
          <h2 class="truncate text-sm font-medium">\${title}</h2>
          <app-icon class="size-4" name="x"></app-icon>
        </div>\`;
    `);
    expect(violations).toEqual([]);
  });

  it("allows data-slot attributes in templates as mount targets", () => {
    const code = 'export const v = html`<div class="card"><div data-slot="content"></div></div>`;';
    expect(ts(code)).toEqual([]);
  });

  it("reports violations with the tag's source position", () => {
    const code =
      'const a = 1;\nexport const v = html`\n  <div>\n    <main data-component="page"></main>\n  </div>`;';
    expect(ts(code)).toMatchObject([{ rule: "data-component-not-root", line: 4, column: 5 }]);
  });

  it("reports data-component that is not on the template root", () => {
    const violations = ts(
      'export const v = html`<div class="a"><div data-component="b"></div></div>`;',
    );
    expect(rules(violations)).toEqual(["data-component-not-root"]);
  });

  it("reports layout utilities on containers but not on leaf elements", () => {
    const violations = ts(`
      export const v = html\`
        <div class="absolute top-1.5 ml-8 w-full text-sm">
          <span class="ml-2 w-4 truncate"></span>
          <app-icon class="size-4"></app-icon>
        </div>\`;
    `);
    expect(violations.map((v) => v.message)).toEqual([
      expect.stringContaining('"absolute"'),
      expect.stringContaining('"top-1.5"'),
      expect.stringContaining('"ml-8"'),
      expect.stringContaining('"w-full"'),
    ]);
    expect(rules(violations)).toEqual(Array(4).fill("no-layout-utility"));
  });

  it("understands variants and arbitrary values through Tailwind", () => {
    const violations = ts(
      'export const v = html`<div class="md:p-2 w-[12rem] data-[state=open]:rotate-90"></div>`;',
    );
    expect(violations.map((v) => v.message)).toEqual([
      expect.stringContaining('"md:p-2"'),
      expect.stringContaining('"w-[12rem]"'),
    ]);
  });

  it("reports long class strings", () => {
    const violations = ts(
      'export const v = html`<span class="truncate text-sm text-xs font-medium italic underline uppercase"></span>`;',
    );
    expect(rules(violations)).toEqual(["long-class-string"]);
  });

  it("ignores dynamic class parts and non-utility class names", () => {
    const violations = ts(
      "export const v = html`<div class=\"menu-item ${open ? 'w-full' : ''} -is-open\"></div>`;",
    );
    expect(violations).toEqual([]);
  });

  it("ignores templates that are not tagged with html", () => {
    expect(ts('export const v = `<div class="a"><div data-component="b"></div></div>`;')).toEqual(
      [],
    );
  });
});

describe("splitByBaseline", () => {
  const violation = {
    file: "a.css",
    line: 1,
    column: 1,
    rule: "no-data-slot-selector",
    message: "m",
  };

  it("separates known from new violations and respects counts", () => {
    const baseline = { "a.css|no-data-slot-selector|m": 1 };
    const { fresh, known } = splitByBaseline([violation, { ...violation, line: 9 }], baseline);
    expect(known).toHaveLength(1);
    expect(fresh).toMatchObject([{ line: 9 }]);
  });

  it("reports everything when there is no baseline", () => {
    expect(splitByBaseline([violation], {}).fresh).toHaveLength(1);
  });
});
