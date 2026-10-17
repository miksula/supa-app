import { html, render } from "lit";
import { AppBar } from "@/lib/AppBar.ts";
import { AppFooter } from "@/lib/AppFooter.ts";
import type { LayoutFactory, LayoutInstance } from "./types.ts";

export const AppLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  render(
    html`
      <div class="app-layout">
        <header></header>
        <main class="content rounded" data-slot="page"></main>
        <footer></footer>
      </div>
    `,
    container,
  );

  const headerEl = container.querySelector<HTMLElement>(".app-layout > header")!;
  const footerEl = container.querySelector<HTMLElement>(".app-layout > footer")!;
  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  AppBar(headerEl);
  AppFooter(footerEl);

  return {
    element: container.firstElementChild as HTMLElement,
    contentSlot: slot,
    dispose: () => {
      (headerEl as HTMLElement & { disposeAppBar?: () => void }).disposeAppBar?.();
      (footerEl as HTMLElement & { disposeAppFooter?: () => void }).disposeAppFooter?.();
    },
  };
};
