import { html, nothing, render } from "lit";
import "./login-layout.css";
import type { LayoutFactory, LayoutInstance } from "../types.ts";

export const LoginLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  render(
    html`
      <div class="login-layout">
        <div class="content" data-slot="page"></div>
      </div>
    `,
    container,
  );

  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;
  return {
    contentSlot: slot,
    dispose: () => render(nothing, container),
  };
};
