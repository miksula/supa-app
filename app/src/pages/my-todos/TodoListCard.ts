import { html, nothing, render } from "lit";
import type { Dispose } from "@/types.ts";
import "./todo-list-card.css";
import "@/ui/AppIcon.ts";
import { TodoList, type TodoListOptions } from "./TodoList.ts";
import type { TodoListData } from "./TodoStore.ts";

export type TodoListCardOptions = TodoListOptions & {
  onRename: (listId: string, name: string) => Promise<unknown>;
  onDelete: (listId: string) => Promise<unknown>;
};

export type TodoListCardController = {
  element: HTMLElement;
  update: (list: TodoListData) => void;
  destroy: Dispose;
};

export function TodoListCard(
  el: HTMLElement,
  initialList: TodoListData,
  options: TodoListCardOptions,
): TodoListCardController {
  let list = initialList;
  let editing = false;
  let skipBlurSave = false;
  let disposed = false;

  el.className = "todo-list-card";
  el.dataset.component = "todo-list-card";
  el.dataset.key = list.id;

  render(
    html`
      <div class="card-inner">
        <header class="card-header">
          <h2 class="card-title">
            <button type="button" class="card-title-button" title="Edit list name"></button>
          </h2>
          <input name="edit-title" type="text" class="card-title-input" aria-label="List name" />
          <button
            type="button"
            class="card-delete-button"
            title="Delete list"
            aria-label="Delete list"
          >
            <app-icon name="trash" size="16"></app-icon>
          </button>
        </header>
        <div class="todo-list"></div>
      </div>
    `,
    el,
  );

  const titleButton = el.querySelector<HTMLButtonElement>(".card-title-button");
  const titleInput = el.querySelector<HTMLInputElement>(".card-title-input");
  const deleteButton = el.querySelector<HTMLButtonElement>(".card-delete-button");
  const todoList = el.querySelector<HTMLElement>(".todo-list");

  if (!titleButton || !titleInput || !deleteButton || !todoList) {
    throw new Error("Unable to mount todo list card: required element is missing");
  }

  const mountedTitleButton = titleButton;
  const mountedTitleInput = titleInput;
  const mountedDeleteButton = deleteButton;
  const mountedTodoList = todoList;
  const currentName = () => list.name ?? "";
  const focusTitleButton = () => mountedTitleButton.focus();

  const startEditing = () => {
    editing = true;
    el.classList.add("-is-editing");
    mountedTitleInput.value = currentName();
    mountedTitleInput.focus();
    mountedTitleInput.select();
  };

  const cancelEditing = () => {
    editing = false;
    mountedTitleInput.value = currentName();
    el.classList.remove("-is-editing");
    focusTitleButton();
  };

  const saveTitleInput = async (restoreFocus = false) => {
    if (!editing || skipBlurSave) {
      skipBlurSave = false;
      return;
    }

    editing = false;
    el.classList.remove("-is-editing");

    const name = mountedTitleInput.value.trim();
    if (name === currentName()) {
      if (restoreFocus) focusTitleButton();
      return;
    }

    if (restoreFocus) focusTitleButton();

    try {
      await options.onRename(list.id, name);
    } catch (error) {
      if (disposed) return;
      mountedTitleInput.value = currentName();
      console.error("Failed to update list name", error);
    }
  };

  const onTitleBlur = (event: FocusEvent) => {
    if (event.relatedTarget === mountedDeleteButton) return;
    void saveTitleInput();
  };

  const onDeleteBlur = (event: FocusEvent) => {
    if (event.relatedTarget === mountedTitleInput) return;
    void saveTitleInput();
  };

  const onTitleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void saveTitleInput(true);
    }
  };

  const onDelete = () => {
    skipBlurSave = false;
    if (
      list.items.length > 0 &&
      !window.confirm("Deleting this list will also delete its tasks. Do you want to continue?")
    ) {
      return;
    }
    void options.onDelete(list.id).catch((error: unknown) => {
      console.error("Failed to delete list", error);
    });
  };

  const preserveEditOnDeletePointerDown = () => {
    skipBlurSave = true;
  };

  mountedTitleButton.addEventListener("click", startEditing);
  mountedTitleInput.addEventListener("blur", onTitleBlur);
  mountedTitleInput.addEventListener("keydown", onTitleKeydown);
  mountedDeleteButton.addEventListener("mousedown", preserveEditOnDeletePointerDown);
  mountedDeleteButton.addEventListener("touchstart", preserveEditOnDeletePointerDown);
  mountedDeleteButton.addEventListener("blur", onDeleteBlur);
  mountedDeleteButton.addEventListener("click", onDelete);

  function update(nextList: TodoListData) {
    if (disposed) return;
    list = nextList;
    mountedTitleButton.textContent = list.name || "...";
    if (!editing) mountedTitleInput.value = currentName();
    TodoList(mountedTodoList, list, {
      onAddTodo: options.onAddTodo,
      onToggleTodo: options.onToggleTodo,
    });
  }

  update(list);

  return {
    element: el,
    update,
    destroy: () => {
      if (disposed) return;
      disposed = true;
      mountedTitleButton.removeEventListener("click", startEditing);
      mountedTitleInput.removeEventListener("blur", onTitleBlur);
      mountedTitleInput.removeEventListener("keydown", onTitleKeydown);
      mountedDeleteButton.removeEventListener("mousedown", preserveEditOnDeletePointerDown);
      mountedDeleteButton.removeEventListener("touchstart", preserveEditOnDeletePointerDown);
      mountedDeleteButton.removeEventListener("blur", onDeleteBlur);
      mountedDeleteButton.removeEventListener("click", onDelete);
      render(nothing, mountedTodoList);
      render(nothing, el);
    },
  };
}
