import type { Dispose, LayoutFactory, LayoutInstance, Mount } from "./types.ts";

type PageMount = {
  page: Mount;
  layout: LayoutFactory;
  transition?: boolean;
};

export function createLayoutManager(container: HTMLElement) {
  let layoutFactory: LayoutFactory | undefined;
  let layoutInstance: LayoutInstance | undefined;
  let disposePage: Dispose | undefined;
  let transitionEnabled = false;
  let revision = 0;
  let activeTransition: ViewTransition | undefined;

  return {
    show(next: PageMount) {
      const currentRevision = ++revision;
      const animate = layoutFactory !== next.layout && (transitionEnabled || next.transition);
      activeTransition?.skipTransition();

      const updateDOM = () => {
        if (currentRevision !== revision) return;
        disposePage?.();
        disposePage = undefined;
        if (layoutFactory !== next.layout || !layoutInstance) {
          layoutInstance?.dispose?.();
          layoutInstance = next.layout(container);
          layoutFactory = next.layout;
        }
        transitionEnabled = next.transition ?? false;
        disposePage = next.page(layoutInstance.contentSlot) || undefined;
      };

      if (
        !animate ||
        !container.hasChildNodes() ||
        !document.startViewTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        updateDOM();
        return;
      }

      activeTransition = document.startViewTransition(updateDOM);
      void activeTransition.ready.catch(() => {});
      void activeTransition.finished.catch((error: unknown) => {
        console.error("Failed to update page", error);
      });
    },
    dispose() {
      revision++;
      activeTransition?.skipTransition();
      disposePage?.();
      disposePage = undefined;
      layoutInstance?.dispose?.();
      layoutInstance = undefined;
      layoutFactory = undefined;
      transitionEnabled = false;
    },
  };
}
