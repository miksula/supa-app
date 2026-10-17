// import { TodoApp } from "@/lib/TodoApp.ts";
import { MyTodos } from "@/lib/MyTodos.ts";

export function Home(el: HTMLElement) {
  // Delegate rendering to the TodoApp component.
  MyTodos(el);
}
