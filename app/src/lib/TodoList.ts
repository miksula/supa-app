import { html, render } from "lit";
import checkIcon from "@/assets/check-icon.svg";
import plusIcon from "@/assets/plus-icon.svg";
import type { ListWithTodoRow, Todo } from "@/lib/TodoStore.ts";

export type TodoListData = Pick<ListWithTodoRow, "id" | "created_at" | "name" | "owner_id"> & {
  items: Todo[];
};

type TodoListOptions = {
  onSubmit: (event: SubmitEvent, listId: string) => void;
  onCompleted: (event: Event, todoId: string) => void;
};

function TodoItem(todo: Todo, onCompleted: TodoListOptions["onCompleted"]) {
  return html`
    <div class="todo-item ${todo.completed ? "-done" : ""}" data-key="${todo.id}">
      <div class="checkbox">
        <input
          type="checkbox"
          aria-label="${todo.description}"
          .checked=${Boolean(todo.completed)}
          @change=${(event: Event) => onCompleted(event, todo.id)}
        />
      </div>
      <p class="label"><button type="button" title="Edit">${todo.description}</button></p>
      <p class="form">
        <input
          type="text"
          class="input use-focus-other"
          aria-label="Label"
          value="${todo.description}"
        />
        <button type="button" class="app-button save" title="Save" tabindex="-1">
          <img class="app-icon" src="${checkIcon}" alt="" aria-hidden="true" />
        </button>
      </p>
    </div>
  `;
}

function TodoInput(listId: string, onSubmit: TodoListOptions["onSubmit"]) {
  return html`
    <form
      class="todo-item-input"
      data-key="todo-item-input${listId}"
      @submit=${(event: SubmitEvent) => onSubmit(event, listId)}
    >
      <input type="text" name="description" class="input use-focus-other" aria-label="Add todo" />
      <button type="submit" class="app-button save" title="Add todo" tabindex="-1">
        <img class="app-icon" src="${plusIcon}" alt="" aria-hidden="true" />
      </button>
    </form>
  `;
}

export function TodoList(el: HTMLElement, list: TodoListData, options: TodoListOptions) {
  render(
    html`
      <div class="items">${list.items.map((todo) => TodoItem(todo, options.onCompleted))}</div>
      ${TodoInput(list.id, options.onSubmit)}
    `,
    el,
  );
}
