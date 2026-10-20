import { html, render } from "lit";
import { MyTodos, type MyTodosDependencies } from "./MyTodos.ts";

export function MyTodosPage(el: HTMLElement, dependencies: MyTodosDependencies) {
  render(html`<div class="flex flex-col h-full" data-component="my-todos-page"></div>`, el);

  const page = el.querySelector<HTMLElement>('[data-component="my-todos-page"]');
  if (!page) {
    throw new Error("Unable to mount my todos page: page container is missing");
  }

  return MyTodos(page, dependencies);
}
