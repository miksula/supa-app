import { html, render } from "lit";
import addListIcon from "@/assets/add-list-icon.svg";
import checkIcon from "@/assets/check-icon.svg";
import nextIcon from "@/assets/next-icon.svg";
import plusIcon from "@/assets/plus-icon.svg";
import previousIcon from "@/assets/previous-icon.svg";
import trashIcon from "@/assets/trash-icon.svg";
import { authService } from "@/lib/auth.ts";
import { powersync } from "@/lib/client.ts";
import { type ListWithTodoRow, type Todo, TodoStore } from "@/lib/TodoStore.ts";

type TodoList = Pick<ListWithTodoRow, "id" | "created_at" | "name" | "owner_id"> & {
  items: Todo[];
};

const mapTodoLists = (rows: ListWithTodoRow[]): TodoList[] => {
  const lists = new Map<string, TodoList>();

  for (const row of rows) {
    let list = lists.get(row.id);

    if (!list) {
      list = {
        id: row.id,
        created_at: row.created_at,
        name: row.name,
        owner_id: row.owner_id,
        items: [],
      };
      lists.set(row.id, list);
    }

    if (row.item_id) {
      list.items.push({
        id: row.item_id,
        created_at: row.item_created_at,
        completed_at: row.item_completed_at,
        description: row.item_description,
        completed: row.item_completed,
        created_by: row.item_created_by,
        completed_by: row.item_completed_by,
        list_id: row.item_list_id,
      });
    }
  }

  return [...lists.values()];
};

const Icon = (src: string) => html`<img class="app-icon" src="${src}" alt="" aria-hidden="true" />`;

function TodoItem(todo: Todo, onCompleted: (event: Event, todoId: string) => void) {
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
          ${Icon(checkIcon)}
        </button>
      </p>
    </div>
  `;
}

function TodoInput(listId: string, onSubmit?: (event: SubmitEvent, listId: string) => void) {
  const interactive = Boolean(onSubmit);

  return html`
    <form
      class="todo-item-input"
      data-key="todo-item-input${listId}"
      @submit=${onSubmit ? (event: SubmitEvent) => onSubmit(event, listId) : undefined}
    >
      <input
        type="text"
        name="description"
        class="input use-focus-other"
        aria-label="Add todo"
        ?disabled=${!interactive}
      />
      <button
        type="${interactive ? "submit" : "button"}"
        class="app-button save"
        title="Add todo"
        tabindex="-1"
        ?disabled=${!interactive}
      >
        ${Icon(plusIcon)}
      </button>
    </form>
  `;
}

function ListCard(
  list: TodoList,
  index: number,
  onSubmit: (event: SubmitEvent, listId: string) => void,
  onCompleted: (event: Event, todoId: string) => void,
  onRename: (listId: string, name: string) => Promise<void>,
) {
  const title = list.name || "...";
  const currentName = list.name ?? "";
  let editing = false;

  const startEditing = (event: Event) => {
    const titleButton = event.currentTarget;
    if (!(titleButton instanceof HTMLButtonElement)) {
      console.error("Unable to edit list: title target is not a button");
      return;
    }

    const card = titleButton.closest(".todo-custom-list");
    const input = card?.querySelector<HTMLInputElement>(".header > .form > .input");
    if (!card || !input) {
      console.error("Unable to edit list: title input is missing");
      return;
    }

    editing = true;
    card.classList.add("-editing");
    input.value = currentName;
    input.focus();
    input.select();
  };

  const cancelEditing = (event: Event) => {
    if (!(event.currentTarget instanceof HTMLInputElement)) {
      console.error("Unable to cancel list edit: title input is missing");
      return;
    }

    const card = event.currentTarget.closest(".todo-custom-list");
    if (!card) {
      console.error("Unable to cancel list edit: list card is missing");
      return;
    }

    editing = false;
    event.currentTarget.value = currentName;
    card.classList.remove("-editing");
  };

  const saveTitle = async (event: Event) => {
    if (!(event.currentTarget instanceof HTMLInputElement)) {
      console.error("Unable to save list name: title input is missing");
      return;
    }

    const input = event.currentTarget;
    const card = input.closest(".todo-custom-list");
    if (!card || !editing) {
      return;
    }

    editing = false;
    card.classList.remove("-editing");

    const name = input.value.trim();
    if (name === currentName) {
      return;
    }

    try {
      await onRename(list.id, name);
    } catch (error) {
      input.value = currentName;
      console.error("Failed to update list name", error);
    }
  };

  const onTitleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing(event);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void saveTitle(event);
    }
  };

  return html`
    <div
      class="card todo-custom-list"
      data-key="${list.id}"
      style="transform: translateX(${index * 100}%); height: 310px;"
    >
      <div class="header">
        <h2 class="title">
          <button
            type="button"
            title="Edit"
            @click=${startEditing}
            @focus=${startEditing}
          >${title}</button>
        </h2>
        <p class="form">
          <input
            type="text"
            class="input use-focus-other"
            aria-label="Title"
            .value=${currentName}
            @blur=${saveTitle}
            @keydown=${onTitleKeydown}
          />
          <button type="button" class="app-button delete" title="Delete">${Icon(trashIcon)}</button>
        </p>
      </div>
      <div class="todo-list">
        <div class="items">${list.items.map((todo) => TodoItem(todo, onCompleted))}</div>
        ${TodoInput(list.id, onSubmit)}
      </div>
    </div>
  `;
}

export function TodoApp(el: HTMLElement, store = new TodoStore(powersync)) {
  const abortController = new AbortController();

  async function onSubmit(event: SubmitEvent, listId: string) {
    event.preventDefault();

    if (!(event.currentTarget instanceof HTMLFormElement)) {
      console.error("Unable to create todo: submit target is not a form");
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem("description");
    if (!(input instanceof HTMLInputElement)) {
      console.error("Unable to create todo: description input is missing");
      return;
    }

    const description = input.value.trim();
    if (!description) {
      input.focus();
      return;
    }

    try {
      await store.createTodo({ description, listId });
      form.reset();
    } catch (error) {
      console.error("Failed to create todo", error);
    }
  }

  function onCompleted(event: Event, todoId: string) {
    if (!(event.currentTarget instanceof HTMLInputElement)) {
      console.error("Unable to update todo: change target is not a checkbox");
      return;
    }

    const checkbox = event.currentTarget;
    const completed = checkbox.checked;

    void store.setTodoCompleted(todoId, completed).catch((error: unknown) => {
      checkbox.checked = !completed;
      console.error("Failed to update todo completion", error);
    });
  }

  async function onAddList() {
    const ownerId = authService.session?.user.id;
    if (!ownerId) {
      console.error("Unable to create list: no authenticated user");
      return;
    }

    try {
      await store.createList({ name: "", ownerId });
    } catch (error) {
      console.error("Failed to create list", error);
    }
  }

  async function onRename(listId: string, name: string) {
    await store.updateListName(listId, name);
  }

  function renderComponent(rows: ListWithTodoRow[] = []) {
    const lists = mapTodoLists(rows);

    render(
      html`
        <div class="todo-frame -custom -animated" style="height: 360px;">
          <div class="leftcontrols">
            <p>
              <button type="button" class="app-button -circle -xl back" title="Previous">
                ${Icon(previousIcon)}
              </button>
            </p>
          </div>
          <div class="container">
            ${lists.map((list, index) =>
              ListCard(list, index, onSubmit, onCompleted, onRename),
            )}
          </div>
          <div class="rightcontrols">
            <p>
              <button type="button" class="app-button -circle -xl forward" title="Next">
                ${Icon(nextIcon)}
              </button>
            </p>
            <p>
              <button
                type="button"
                class="app-button -circle -xl add"
                title="Add custom list"
                @click=${onAddList}
              >
                ${Icon(addListIcon)}
              </button>
            </p>
          </div>
        </div>
      `,
      el,
    );
  }

  renderComponent();

  void (async () => {
    try {
      for await (const result of store.watchUserLists({
        signal: abortController.signal,
      })) {
        if (!abortController.signal.aborted) {
          renderComponent(result.array as ListWithTodoRow[]);
        }
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error("Failed to watch todos", error);
      }
    }
  })();

  return () => abortController.abort();
}
