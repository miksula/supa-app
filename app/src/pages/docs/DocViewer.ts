import { html, render } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import { router } from "@packages/router";

export interface DocViewerProps {
  content: string;
}

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

export function DocViewer(target: HTMLElement, props: DocViewerProps) {
  const preprocessed = preprocessObsidianMarkdown(props.content);
  const parsedHtml = marked.parse(preprocessed, {
    gfm: true,
    breaks: false,
  }) as string;

  const handleClick = (event: MouseEvent) => {
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
      router.navigate(href);
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
}
