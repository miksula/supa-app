import { html, render } from "lit";
import { AppBar } from "@/lib/AppBar.ts";
import type { LayoutFactory, LayoutInstance } from "./types.ts";

export const AppLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  render(
    html`
      <div class="app-shell app-layout">
        <header></header>
        <div class="content rounded" data-slot="page"></div>
      </div>
    `,
    container,
  );

  const headerEl = container.querySelector<HTMLElement>(".app-shell > header")!;
  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  AppBar(headerEl);

  return {
    element: container.firstElementChild as HTMLElement,
    contentSlot: slot,
    dispose: () => {
      (headerEl as HTMLElement & { disposeAppBar?: () => void }).disposeAppBar?.();
    },
  };
};
