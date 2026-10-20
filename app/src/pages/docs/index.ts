import { html, nothing, render } from "lit";
import "@/ui/app-link.css";
import type { Dispose } from "@/types.ts";
import { getDocContent } from "@packages/docs";
import { DocViewer } from "./DocViewer.ts";

export function DocsPage(
  target: HTMLElement,
  {
    docId = "introduction",
    navigate,
  }: {
    docId?: string;
    navigate: (path: string) => void;
  },
): Dispose {
  let disposed = false;
  let disposeViewer: Dispose | undefined;

  // Render initial loading skeleton
  render(
    html`
      <div class="docs-page loading" data-component="docs-page">
        <div class="flex flex-col gap-4 p-6 max-w-4xl mx-auto">
          <div class="h-8 w-64 animate-pulse rounded-lg bg-(--surface-raised)"></div>
          <div class="h-4 w-full animate-pulse rounded bg-(--surface-raised)"></div>
          <div class="h-4 w-5/6 animate-pulse rounded bg-(--surface-raised)"></div>
          <div class="h-4 w-4/6 animate-pulse rounded bg-(--surface-raised)"></div>
        </div>
      </div>
    `,
    target,
  );

  void getDocContent(docId)
    .then((content) => {
      if (disposed) {
        return;
      }

      if (content === null) {
        render(
          html`
            <div class="docs-page not-found" data-component="docs-page">
              <div class="p-6 max-w-4xl mx-auto">
                <h1 class="text-2xl font-bold mb-2">Documentation not found</h1>
                <p class="text-sm text-(--muted-foreground) mb-4">
                  No documentation was found for:
                  <code class="px-1.5 py-0.5 rounded bg-(--surface-raised)">${docId}</code>
                </p>
                <p class="text-sm">
                  <a
                    href="/docs/introduction"
                    class="app-link"
                    @click=${(e: Event) => {
                      e.preventDefault();
                      navigate("/docs/introduction");
                    }}
                  >
                    Return to introduction
                  </a>
                </p>
              </div>
            </div>
          `,
          target,
        );
        return;
      }

      render(
        html`
          <div class="docs-page" data-component="docs-page">
            <div class="docs-container w-full max-w-4xl mx-auto p-6">
              <div data-slot="doc-viewer-outlet"></div>
            </div>
          </div>
        `,
        target,
      );

      const docViewerOutlet = target.querySelector<HTMLElement>('[data-slot="doc-viewer-outlet"]');
      if (docViewerOutlet) {
        disposeViewer = DocViewer(docViewerOutlet, { content, navigate });
      }
    })
    .catch((error: unknown) => {
      if (disposed) return;
      console.error("Failed to load documentation", error);
      render(html`<p role="alert">Failed to load documentation. Try again.</p>`, target);
    });

  return () => {
    if (disposed) return;
    disposed = true;
    disposeViewer?.();
    render(nothing, target);
  };
}
