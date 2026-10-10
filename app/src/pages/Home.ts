import { TodoApp } from "@/lib/TodoApp.ts";

export function Home(el: HTMLElement) {
  // Delegate rendering to the TodoApp component.
  TodoApp(el);
}
