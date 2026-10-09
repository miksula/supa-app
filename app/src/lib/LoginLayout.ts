import { html, render } from "lit";
import type { LayoutFactory, LayoutInstance } from "./types.ts";

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
    element: container.firstElementChild as HTMLElement,
    contentSlot: slot,
  };
};
