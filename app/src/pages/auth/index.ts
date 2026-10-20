import { html, render } from "lit";
import { Login, type LoginProps } from "./Login.ts";

export type { LoginProps };

export function LoginPage(el: HTMLElement, props: LoginProps) {
  render(html`<div class="login-page" data-component="login-page"></div>`, el);

  const page = el.querySelector<HTMLElement>('[data-component="login-page"]');
  if (!page) {
    throw new Error("Unable to mount login page: page container is missing");
  }

  return Login(page, props);
}
