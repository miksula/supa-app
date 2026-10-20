import { html, render } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "@/ui/AppIcon.ts";
import type { Todo } from "./TodoStore.ts";

export type TodoListOptions = {
  onSubmit: (event: SubmitEvent, listId: string) => void;
  onCompleted: (event: Event, todoId: string) => void;
};

function TodoItem(todo: Todo, onCompleted: TodoListOptions["onCompleted"]) {
  return html`
    <li class="todo-item ${todo.completed ? "-is-done" : ""}" data-key="${todo.id}">
      <label class="todo-item-row">
        <input
          type="checkbox"
          class="todo-item-checkbox"
          .checked=${Boolean(todo.completed)}
          @change=${(event: Event) => onCompleted(event, todo.id)}
        />
        <span class="todo-item-label">${todo.description}</span>
      </label>
    </li>
  `;
}

function TodoInput(listId: string, onSubmit: TodoListOptions["onSubmit"]) {
  return html`
    <form
      class="todo-input"
      data-key="todo-input-${listId}"
      @submit=${(event: SubmitEvent) => onSubmit(event, listId)}
    >
      <input
        type="text"
        name="description"
        class="todo-input-field"
        placeholder="Lisää tehtävä"
        aria-label="Uusi tehtävä"
        autocomplete="off"
      />
      <button
        type="submit"
        class="todo-input-submit"
        title="Lisää tehtävä"
        aria-label="Lisää tehtävä"
        tabindex="-1"
      >
        <app-icon name="plus" size="16"></app-icon>
      </button>
    </form>
  `;
}

export function TodoList(
  el: HTMLElement,
  list: { id: string; items: Todo[] },
  options: TodoListOptions,
) {
  render(
    html`
      <ul class="todo-items">
        ${repeat(
          list.items,
          (todo) => todo.id,
          (todo) => TodoItem(todo, options.onCompleted),
        )}
      </ul>
      ${TodoInput(list.id, options.onSubmit)}
    `,
    el,
  );
}
