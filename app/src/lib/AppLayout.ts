import { html, render } from "lit";
// import { AppBar } from "@/lib/AppBar.ts";
// import { AppFooter } from "@/lib/AppFooter.ts";
import type { LayoutFactory, LayoutInstance } from "./types.ts";

export const AppLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  render(
    html`
      <div class="app-layout">
        <aside></aside>
        <main class="content rounded" data-slot="page"></main>
        <!-- <footer></footer> -->
      </div>
    `,
    container,
  );

  const asideEl = container.querySelector<HTMLElement>(".app-layout > aside")!;
  // const footerEl = container.querySelector<HTMLElement>(".app-layout > footer")!;
  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  // AppBar(headerEl);
  // AppFooter(footerEl);

  return {
    element: container.firstElementChild as HTMLElement,
    contentSlot: slot,
    dispose: () => {
      (asideEl as HTMLElement & { disposeAppBar?: () => void }).disposeAppBar?.();
      // (footerEl as HTMLElement & { disposeAppFooter?: () => void }).disposeAppFooter?.();
    },
  };
};
