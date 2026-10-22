import "./todo-list.css";
import { html, render } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { TodoInput } from "./TodoInput.ts";
import { TodoItem } from "./TodoItem.ts";
import type { Todo } from "../TodoStore.ts";

export type TodoListOptions = {
  onAddTodo: (listId: string, description: string) => Promise<unknown>;
  onToggleTodo: (todoId: string, completed: boolean) => Promise<unknown>;
};

export function TodoList(
  el: HTMLElement,
  list: { id: string; items: Todo[] },
  options: TodoListOptions,
) {
  el.dataset.component = "todo-list";
  render(
    html`
      <ul class="todo-items">
        ${repeat(
          list.items,
          (todo) => todo.id,
          (todo) => TodoItem(todo, options.onToggleTodo),
        )}
      </ul>
      ${TodoInput(list.id, options.onAddTodo)}
    `,
    el,
  );
}
