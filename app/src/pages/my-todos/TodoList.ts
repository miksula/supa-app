import { html, render } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "@/ui/AppIcon.ts";
import type { Todo } from "./TodoStore.ts";

export type TodoListOptions = {
  onAddTodo: (listId: string, description: string) => Promise<unknown>;
  onToggleTodo: (todoId: string, completed: boolean) => Promise<unknown>;
};

function TodoItem(todo: Todo, onToggleTodo: TodoListOptions["onToggleTodo"]) {
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

function TodoInput(listId: string, onAddTodo: TodoListOptions["onAddTodo"]) {
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const input = form.elements.namedItem("description") as HTMLInputElement;
    const description = input.value.trim();

    if (!description) {
      input.focus();
      return;
    }

    try {
      await onAddTodo(listId, description);
      form.reset();
    } catch (error) {
      console.error("Failed to create todo", error);
    }
  };

  return html`
    <form class="todo-input" data-key="todo-input-${listId}" @submit=${submit}>
      <input
        type="text"
        name="description"
        class="todo-input-field"
        placeholder="Add a task"
        aria-label="New task"
        autocomplete="off"
      />
      <button
        type="submit"
        class="todo-input-submit"
        title="Add a task"
        aria-label="Add a task"
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
          (todo) => TodoItem(todo, options.onToggleTodo),
        )}
      </ul>
      ${TodoInput(list.id, options.onAddTodo)}
    `,
    el,
  );
}
