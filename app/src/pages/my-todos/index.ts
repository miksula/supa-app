import { html, render } from "lit";
import { MyTodos } from "./MyTodos.ts";

export function MyTodosPage(el: HTMLElement) {
  const template = html`
    <div class="flex flex-col h-full" data-component="my-todos-page">${MyTodos()}</div>
  `;
  render(template, el);
}
