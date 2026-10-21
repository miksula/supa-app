import type { Dispose } from "@/types.ts";

export type CarouselButtons = {
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
};

export type CarouselController = {
  /** Re-evaluates which buttons are enabled; call after items are added or removed. */
  refresh: () => void;
  /** Scrolls just enough to make the item fully visible. */
  reveal: (item: HTMLElement) => void;
  destroy: Dispose;
};

// Fractional column widths (33.333%) can leave scrollLeft a sub-pixel short of either edge.
const EDGE_TOLERANCE_PX = 1;

/**
 * Prev/next buttons for a CSS scroll-snap track. Layout, snapping, swipe and
 * smooth scrolling are handled by the browser (see my-todos.css).
 */
export function Carousel(
  track: HTMLElement,
  { previousButton, nextButton }: CarouselButtons,
): CarouselController {
  let pendingFrame = 0;

  const refresh = () => {
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    previousButton.disabled = track.scrollLeft <= EDGE_TOLERANCE_PX;
    nextButton.disabled = track.scrollLeft >= maxScrollLeft - EDGE_TOLERANCE_PX;
  };

  const refreshOnNextFrame = () => {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      refresh();
    });
  };

  const scrollOneItem = (direction: -1 | 1) => {
    const firstItem = track.firstElementChild as HTMLElement | null;
    const itemWidth = firstItem?.offsetWidth || track.clientWidth;
    track.scrollBy({ left: direction * itemWidth });
  };

  const showPrevious = () => scrollOneItem(-1);
  const showNext = () => scrollOneItem(1);

  previousButton.addEventListener("click", showPrevious);
  nextButton.addEventListener("click", showNext);
  track.addEventListener("scroll", refreshOnNextFrame, { passive: true });
  const resizeObserver = new ResizeObserver(refreshOnNextFrame);
  resizeObserver.observe(track);

  refresh();

  return {
    refresh,
    reveal: (item) => item.scrollIntoView({ block: "nearest", inline: "nearest" }),
    destroy: () => {
      cancelAnimationFrame(pendingFrame);
      resizeObserver.disconnect();
      track.removeEventListener("scroll", refreshOnNextFrame);
      previousButton.removeEventListener("click", showPrevious);
      nextButton.removeEventListener("click", showNext);
    },
  };
}
