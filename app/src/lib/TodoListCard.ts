import { html, render } from "lit";
import trashIcon from "@/assets/trash-icon.svg";
import { TodoList, type TodoListData } from "@/lib/TodoList.ts";

export type TodoListCardOptions = {
  onSubmit: (event: SubmitEvent, listId: string) => void;
  onCompleted: (event: Event, todoId: string) => void;
  onRename: (listId: string, name: string) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
};

export type TodoListCardController = {
  element: HTMLElement;
  update: (list: TodoListData, index: number) => void;
  setPosition: (position: number) => void;
  destroy: () => void;
};

export function TodoListCard(
  el: HTMLElement,
  initialList: TodoListData,
  index: number,
  options: TodoListCardOptions,
): TodoListCardController {
  let list = initialList;
  let editing = false;
  let skipBlurSave = false;

  el.className = "card todo-custom-list";
  el.dataset.key = list.id;

  render(
    html`
      <div class="header">
        <h2 class="title">
          <button type="button" title="Edit"></button>
        </h2>
        <p class="form">
          <input name="edit-title" type="text" class="input use-focus-other" aria-label="Title" />
          <button type="button" class="app-button delete" title="Delete">
            <img class="app-icon" src="${trashIcon}" alt="" aria-hidden="true" />
          </button>
        </p>
      </div>
      <div class="todo-list"></div>
    `,
    el,
  );

  const titleButton = el.querySelector<HTMLButtonElement>(".title > button")!;
  const titleInput = el.querySelector<HTMLInputElement>(".form > .input")!;
  const deleteButton = el.querySelector<HTMLButtonElement>(".delete")!;
  const todoList = el.querySelector<HTMLElement>(".todo-list")!;

  if (!titleButton || !titleInput || !deleteButton || !todoList) {
    throw new Error("Unable to mount todo list card: required element is missing");
  }

  const currentName = () => list.name ?? "";

  const startEditing = () => {
    editing = true;
    el.classList.add("-editing");
    titleInput.value = currentName();
    titleInput.focus();
    titleInput.select();
  };

  const cancelEditing = () => {
    editing = false;
    titleInput.value = currentName();
    el.classList.remove("-editing");
  };

  const saveTitleInput = async () => {
    if (!editing || skipBlurSave) {
      skipBlurSave = false;
      return;
    }

    editing = false;
    el.classList.remove("-editing");

    const name = titleInput.value.trim();
    if (name === currentName()) {
      return;
    }

    try {
      await options.onRename(list.id, name);
    } catch (error) {
      titleInput.value = currentName();
      console.error("Failed to update list name", error);
    }
  };

  const onTitleBlur = (event: FocusEvent) => {
    if (event.relatedTarget === deleteButton) {
      return;
    }

    void saveTitleInput();
  };

  const onDeleteBlur = (event: FocusEvent) => {
    if (event.relatedTarget === titleInput) {
      return;
    }

    void saveTitleInput();
  };

  const onTitleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void saveTitleInput();
    }
  };

  const onDelete = () => {
    skipBlurSave = false;

    if (
      list.items.length > 0 &&
      !window.confirm("Deleting this list will delete its items as well. Are you sure?")
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

  titleButton.addEventListener("click", startEditing);
  titleButton.addEventListener("focus", startEditing);
  titleInput.addEventListener("blur", onTitleBlur);
  titleInput.addEventListener("keydown", onTitleKeydown);
  deleteButton.addEventListener("mousedown", preserveEditOnDeletePointerDown);
  deleteButton.addEventListener("touchstart", preserveEditOnDeletePointerDown);
  deleteButton.addEventListener("blur", onDeleteBlur);
  deleteButton.addEventListener("click", onDelete);

  const setPosition = (position: number) => {
    el.style.transform = `translateX(${position * 100}%)`;
  };

  function update(nextList: TodoListData, nextIndex: number) {
    list = nextList;
    titleButton.textContent = list.name || "...";

    if (!editing) {
      titleInput.value = currentName();
    }

    setPosition(nextIndex);
    el.style.height = "310px";

    TodoList(todoList, list, {
      onSubmit: options.onSubmit,
      onCompleted: options.onCompleted,
    });
  }

  update(list, index);

  return {
    element: el,
    update,
    setPosition,
    destroy: () => {
      titleButton.removeEventListener("click", startEditing);
      titleButton.removeEventListener("focus", startEditing);
      titleInput.removeEventListener("blur", onTitleBlur);
      titleInput.removeEventListener("keydown", onTitleKeydown);
      deleteButton.removeEventListener("mousedown", preserveEditOnDeletePointerDown);
      deleteButton.removeEventListener("touchstart", preserveEditOnDeletePointerDown);
      deleteButton.removeEventListener("blur", onDeleteBlur);
      deleteButton.removeEventListener("click", onDelete);
      // Let Lit handle the removal of the card's DOM since it calls the render().
      render(undefined, el);
    },
  };
}
