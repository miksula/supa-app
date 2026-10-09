import { html, render } from "lit";
import { AppBar } from "@/lib/AppBar.ts";
import { forward } from "@/lib/events.ts";
import type { LayoutFactory, LayoutInstance } from "./types.ts";

export const AppLayout: LayoutFactory = (
  container: HTMLElement,
): LayoutInstance => {
  render(
    html`
      <div class="app-layout">
        <header></header>
        <div class="content rounded" data-slot="page"></div>
      </div>
    `,
    container,
  );

  const headerEl = container.querySelector<HTMLElement>(
    ".app-layout > header",
  )!;
  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  AppBar(headerEl);

  const element = container.firstElementChild as HTMLElement;
  const stopForwardingToHeader = forward(element, () => headerEl, "syncStatus");
  const stopForwardingToSlot = forward(element, () => slot, "syncStatus");

  return {
    element,
    contentSlot: slot,
    dispose: () => {
      stopForwardingToHeader();
      stopForwardingToSlot();
      (headerEl as HTMLElement & { disposeAppBar?: () => void })
        .disposeAppBar?.();
    },
  };
};
