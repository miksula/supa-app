import { html, nothing, render } from "lit";
import type { Dispose } from "@/types.ts";

export function NotFoundPage(el: HTMLElement): Dispose {
  render(html`<h1>Page not found</h1>`, el);
  return () => render(nothing, el);
}
