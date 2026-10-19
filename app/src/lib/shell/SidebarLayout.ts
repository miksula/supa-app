import { html, render } from "lit";
import type { LayoutFactory, LayoutInstance } from "../types.ts";
import { Sidebar } from "./Sidebar.ts";

export const SidebarLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  render(
    html`
      <div class="sidebar-layout" data-component="sidebar-layout">
        <aside></aside>
        <main data-slot="page"></main>
      </div>
    `,
    container,
  );

  const asideEl = container.querySelector<HTMLElement>(".sidebar-layout > aside")!;
  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  Sidebar(asideEl);

  return {
    element: container.firstElementChild as HTMLElement,
    contentSlot: slot,
    dispose: () => {
      const el = asideEl as HTMLElement & {
        disposeSidebar?: () => void;
        disposeAppBar?: () => void;
      };
      el.disposeSidebar?.();
      el.disposeAppBar?.();
    },
  };
};
