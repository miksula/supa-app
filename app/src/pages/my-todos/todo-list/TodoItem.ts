import "./todo-item.css";
import { html } from "lit";
import type { TodoListOptions } from "./TodoList.ts";
import type { Todo } from "../TodoStore.ts";

export function TodoItem(todo: Todo, onToggleTodo: TodoListOptions["onToggleTodo"]) {
  const toggle = (event: Event) => {
    const checkbox = event.currentTarget as HTMLInputElement;
    const completed = checkbox.checked;
    onToggleTodo(todo.id, completed).catch((error: unknown) => {
      checkbox.checked = !completed;
      console.error("Failed to update todo completion", error);
    });
  };

  const getCheckIcon = (completed: boolean) => {
    if (completed) {
      return html`<app-icon
        name="circleCheck"
        size="16"
        class="text-(--text-disabled)"
      ></app-icon>`;
    } else {
      return html`<app-icon name="circle" size="16"></app-icon>`;
    }
  };

  return html`
    <li class="todo-item ${todo.completed ? "-is-done" : ""}" data-key="${todo.id}">
      <label class="todo-item-row">
        ${getCheckIcon(Boolean(todo.completed))}
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
