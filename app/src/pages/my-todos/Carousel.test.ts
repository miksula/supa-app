/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "./Carousel.ts";

const ITEM_WIDTH = 300;

function setup({ items = 4, visibleItems = 2 } = {}) {
  const track = document.createElement("div");
  for (let i = 0; i < items; i++) {
    const item = document.createElement("article");
    Object.defineProperty(item, "offsetWidth", { value: ITEM_WIDTH });
    item.scrollIntoView = vi.fn();
    track.append(item);
  }

  let scrollLeft = 0;
  Object.defineProperties(track, {
    clientWidth: { value: ITEM_WIDTH * visibleItems },
    scrollWidth: { value: ITEM_WIDTH * items },
    scrollLeft: { get: () => scrollLeft, set: (value: number) => (scrollLeft = value) },
  });
  track.scrollBy = vi.fn();

  const previousButton = document.createElement("button");
  const nextButton = document.createElement("button");
  document.body.append(track, previousButton, nextButton);

  const frames: FrameRequestCallback[] = [];
  const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });

  const carousel = Carousel(track, { previousButton, nextButton });
  const scrollTo = (value: number) => {
    scrollLeft = value;
    track.dispatchEvent(new Event("scroll"));
    for (const frame of frames.splice(0)) frame(0);
  };

  return { track, previousButton, nextButton, carousel, scrollTo, requestFrame };
}

describe("Carousel", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("disables previous at the start and next at the end", () => {
    const { previousButton, nextButton, scrollTo } = setup();

    expect(previousButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    scrollTo(ITEM_WIDTH);
    expect(previousButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(false);

    // Sub-pixel short of the end still counts as the end.
    scrollTo(ITEM_WIDTH * 2 - 0.5);
    expect(previousButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true);
  });

  it("disables both buttons when every item fits", () => {
    const { previousButton, nextButton } = setup({ items: 2, visibleItems: 2 });

    expect(previousButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(true);
  });

  it("scrolls by one item width per click", () => {
    const { track, previousButton, nextButton, scrollTo } = setup();
    scrollTo(ITEM_WIDTH);

    nextButton.click();
    previousButton.click();

    expect(track.scrollBy).toHaveBeenNthCalledWith(1, { left: ITEM_WIDTH });
    expect(track.scrollBy).toHaveBeenNthCalledWith(2, { left: -ITEM_WIDTH });
  });

  it("reveals an item with minimal scrolling", () => {
    const { track, carousel } = setup();
    const item = track.lastElementChild as HTMLElement;

    carousel.reveal(item);

    expect(item.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  it("stops responding to clicks and scrolls after destroy", () => {
    const { track, nextButton, carousel, scrollTo, requestFrame } = setup();

    carousel.destroy();
    nextButton.click();
    scrollTo(ITEM_WIDTH);

    expect(track.scrollBy).not.toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
