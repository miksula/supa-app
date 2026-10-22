import "./todo-input.css";
import { html } from "lit";
import "@/ui/AppIcon.ts";
import type { TodoListOptions } from "./TodoList.ts";

export function TodoInput(listId: string, onAddTodo: TodoListOptions["onAddTodo"]) {
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
