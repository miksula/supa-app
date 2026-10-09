import { TodoApp } from "@/lib/TodoApp.ts";

export function Home(el) {
  // Delegate rendering to the TodoApp component.
  TodoApp(el, el.dataset.listId ?? "");
}
