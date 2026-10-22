import { html, nothing, render } from "lit";
import "./doc-viewer.css";
import type { Dispose } from "@/types.ts";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Marked } from "marked";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

export interface DocViewerProps {
  content: string;
  navigate: (path: string) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Highlights fenced blocks whose language is registered; other blocks stay escaped plain text. */
const markdown = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const code = text.replace(/\n$/, "");
      const languageClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      const body =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
          : escapeHtml(code);
      return `<pre><code${languageClass}>${body}</code></pre>\n`;
    },
  },
});

/**
 * Normalizes Obsidian-specific markdown constructs:
 * - Strips YAML frontmatter blocks
 * - Transforms wikilinks [[doc]] and [[doc|label]] into standard markdown router links
 * - Transforms relative .md links to internal /docs/... links
 */
function preprocessObsidianMarkdown(markdown: string): string {
  // Strip YAML frontmatter
  let text = markdown.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, "");

  // Transform Obsidian wikilinks: [[target|label]] or [[target]]
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
    const trimmedTarget = target.trim();
    const displayLabel = label ? label.trim() : trimmedTarget;

    // In-page heading reference: [[#Heading]]
    if (trimmedTarget.startsWith("#")) {
      const anchor = trimmedTarget.slice(1).toLowerCase().replace(/\s+/g, "-");
      return `[${displayLabel}](#${anchor})`;
    }

    // Document reference with optional heading: [[Doc#Heading]]
    const [docPath, anchor] = trimmedTarget.split("#");
    const cleanDoc = docPath.replace(/\.md$/, "");
    const href = anchor
      ? `/docs/${cleanDoc}#${anchor.toLowerCase().replace(/\s+/g, "-")}`
      : `/docs/${cleanDoc}`;

    return `[${displayLabel}](${href})`;
  });

  // Transform relative markdown links: [label](./doc.md) or [label](doc.md) -> [label](/docs/doc)
  text = text.replace(
    /\[([^\]]+)\]\((?:\.\/)?([^):#]+)\.md(#[^)]+)?\)/g,
    (_, label, doc, hash = "") => {
      return `[${label}](/docs/${doc}${hash})`;
    },
  );

  return text;
}

const COLOR_TOKEN_PATTERN =
  /^--(?:surface-(?:page|card|raised|translucent)|avatar-bg|text-(?:primary|muted|disabled|on-accent)|border-(?:strong|subtle)|focus-ring(?:-color)?|control-hover-(?:bg|text)|accent-primary|status-(?:danger|success)|white|black|n[ld]-(?:\d+|card|raised)|color-[a-z]+(?:-\d+)?)$/;

/**
 * Resolves a CSS color expression for an inline `<code>` snippet if it represents
 * a semantic/palette color token or a literal CSS color value.
 */
function resolveSwatchColor(codeText: string): string | null {
  const text = codeText.trim();

  if (text === "--focus-ring" || text === "2px solid var(--focus-ring-color)") {
    return "var(--focus-ring-color)";
  }

  if (COLOR_TOKEN_PATTERN.test(text)) {
    return `var(${text})`;
  }

  const varMatch = text.match(/^var\((--[a-z0-9-]+)(?:,\s*[^)]+)?\)$/i);
  if (varMatch && COLOR_TOKEN_PATTERN.test(varMatch[1])) {
    return text;
  }

  if (
    /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text) ||
    /^(?:lab|oklch|rgb|hsl|color-mix)\([^)]+\)$/i.test(text)
  ) {
    return text;
  }

  return null;
}

function decorateColorCodePills(htmlContent: string): string {
  return htmlContent.replace(/(?<!<pre>)<code>([^<\n]+)<\/code>/g, (full, inner: string) => {
    const swatchColor = resolveSwatchColor(inner);
    if (!swatchColor) return full;
    return `<code class="color-code"><span class="color-swatch" style="--swatch: ${swatchColor}" aria-hidden="true"></span>${inner}</code>`;
  });
}

export function DocViewer(target: HTMLElement, props: DocViewerProps): Dispose {
  let disposed = false;
  const preprocessed = preprocessObsidianMarkdown(props.content);
  const parsedHtml = decorateColorCodePills(markdown.parse(preprocessed) as string);

  const handleClick = (event: MouseEvent) => {
    if (disposed) return;
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;

    if (href.startsWith("#")) {
      const element = target.querySelector(href);
      if (element) {
        event.preventDefault();
        element.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    if (href.startsWith("/") && !href.startsWith("//")) {
      event.preventDefault();
      props.navigate(href);
    }
  };

  render(
    html`
      <div class="doc-viewer" data-component="doc-viewer" @click=${handleClick}>
        <article class="doc-content">${unsafeHTML(parsedHtml)}</article>
      </div>
    `,
    target,
  );

  return () => {
    if (disposed) return;
    disposed = true;
    render(nothing, target);
  };
}
