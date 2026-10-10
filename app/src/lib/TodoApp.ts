import { html, render } from "lit";
import addListIcon from "@/assets/add-list-icon.svg";
import nextIcon from "@/assets/next-icon.svg";
import previousIcon from "@/assets/previous-icon.svg";
import { authService } from "@/lib/auth.ts";
import { powersync } from "@/lib/client.ts";
import { TodoListCard, type TodoListCardController } from "@/lib/TodoListCard.ts";
import { type TodoListData } from "@/lib/TodoList.ts";
import { type ListWithTodoRow, TodoStore } from "@/lib/TodoStore.ts";

const mapTodoLists = (rows: ListWithTodoRow[]): TodoListData[] => {
  const lists = new Map<string, TodoListData>();

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

  async function onDelete(listId: string) {
    await store.deleteList(listId);
  }

  const cardControllers = new Map<string, TodoListCardController>();
  let container: HTMLElement | null = null;

  function renderFrame() {
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
          <div class="container"></div>
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

    container = el.querySelector<HTMLElement>(".todo-frame > .container");
    if (!container) {
      throw new Error("Unable to mount todo app: list container is missing");
    }
  }

  function renderLists(rows: ListWithTodoRow[]) {
    if (!container) {
      throw new Error("Unable to render todo lists: list container is missing");
    }

    const lists = mapTodoLists(rows);
    const activeListIds = new Set(lists.map((list) => list.id));

    for (const [listId, controller] of cardControllers) {
      if (!activeListIds.has(listId)) {
        controller.destroy();
        controller.element.remove();
        cardControllers.delete(listId);
      }
    }

    lists.forEach((list, index) => {
      let controller = cardControllers.get(list.id);
      if (!controller) {
        const card = document.createElement("div");
        controller = TodoListCard(card, list, index, {
          onSubmit,
          onCompleted,
          onRename,
          onDelete,
        });
        cardControllers.set(list.id, controller);
      } else {
        controller.update(list, index);
      }

      container?.append(controller.element);
    });
  }

  renderFrame();

  void (async () => {
    try {
      for await (const result of store.watchUserLists({
        signal: abortController.signal,
      })) {
        if (!abortController.signal.aborted) {
          renderLists(result.array as ListWithTodoRow[]);
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
