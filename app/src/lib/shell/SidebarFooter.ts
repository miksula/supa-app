import { html, nothing, render } from "lit";
import "./sidebar-footer.css";
import { ThemeSwitcher } from "./ThemeSwitcher.ts";
import { SyncStatusIndicator } from "./SyncStatusIndicator.ts";
import type { Dispose } from "@/types.ts";

export function SidebarFooter(el: HTMLElement): Dispose {
  render(
    html`
      <div class="sidebar-footer">
        <div data-slot="theme-switcher"></div>
        <div data-slot="sync-status"></div>
      </div>
    `,
    el,
  );
  const disposeTheme = ThemeSwitcher(
    el.querySelector<HTMLElement>('[data-slot="theme-switcher"]')!,
  );
  const disposeSync = SyncStatusIndicator(
    el.querySelector<HTMLElement>('[data-slot="sync-status"]')!,
  );
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    disposeTheme();
    disposeSync();
    render(nothing, el);
  };
}
