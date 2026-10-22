import "./todo-item.css";
import { html } from "lit";
import type { TodoListOptions } from "./TodoList.ts";
import type { Todo } from "./TodoStore.ts";

export function TodoItem(todo: Todo, onToggleTodo: TodoListOptions["onToggleTodo"]) {
  const toggle = (event: Event) => {
    const checkbox = event.currentTarget as HTMLInputElement;
    const completed = checkbox.checked;
    onToggleTodo(todo.id, completed).catch((error: unknown) => {
      checkbox.checked = !completed;
      console.error("Failed to update todo completion", error);
    });
  };

  return html`
    <li class="todo-item ${todo.completed ? "-is-done" : ""}" data-key="${todo.id}">
      <label class="todo-item-row">
        <input
          type="checkbox"
          class="todo-item-checkbox"
          .checked=${Boolean(todo.completed)}
          @change=${toggle}
        />
        <span class="todo-item-label">${todo.description}</span>
      </label>
    </li>
  `;
}
