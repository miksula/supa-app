/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocViewer } from "./DocViewer.ts";

describe("DocViewer code blocks", () => {
  let target: HTMLElement;
  let dispose: (() => void) | undefined;

  const mount = (content: string) => {
    target = document.createElement("div");
    document.body.append(target);
    dispose = DocViewer(target, { content, navigate: vi.fn() });
    return target;
  };

  afterEach(() => {
    dispose?.();
    target?.remove();
  });

  it("highlights TypeScript fences", () => {
    mount("```ts\nconst answer = 42;\n```");

    const keyword = target.querySelector("pre code.language-ts .hljs-keyword");
    expect(keyword?.textContent).toBe("const");
    expect(target.querySelector("pre code .hljs-number")?.textContent).toBe("42");
  });

  it("highlights Bash fences", () => {
    mount('```bash\necho "hi"\n```');

    expect(target.querySelector("pre code.language-bash .hljs-built_in")?.textContent).toBe("echo");
    expect(target.querySelector("pre code .hljs-string")?.textContent).toBe('"hi"');
  });

  it("keeps untagged and unknown-language fences as escaped plain text", () => {
    mount("```\n<div>&</div>\n```\n\n```foo\n<b>x</b>\n```");

    const codeBlocks = target.querySelectorAll("pre code");
    expect(codeBlocks).toHaveLength(2);
    for (const block of codeBlocks) {
      expect(block.children).toHaveLength(0);
    }
    expect(codeBlocks[0].textContent).toBe("<div>&</div>");
    expect(codeBlocks[1].textContent).toBe("<b>x</b>");
  });
});
