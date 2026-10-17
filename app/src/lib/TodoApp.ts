import { html, render } from "lit";
import "@/lib/AppIcon.ts";
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

export function TodoApp(el: HTMLElement, store = new TodoStore(powersync)) {
  const abortController = new AbortController();

  let container: HTMLElement | null = null;
  let listIds: string[] = [];
  let currentListIndex = 0;
  let hasReceivedListSnapshot = false;

  function renderComponent() {
    render(
      html`
        <div class="todo-app" style="flex-grow: 1;">
          <div class="leftcontrols">
            <p>
              <button
                type="button"
                class="app-button -circle -xl back"
                title="Previous"
                @click=${() => seekLists(-1)}
              >
                <app-icon name="previous"></app-icon>
              </button>
            </p>
          </div>
          <div class="content"></div>
          <div class="rightcontrols">
            <p>
              <button
                type="button"
                class="app-button -circle -xl forward"
                title="Next"
                @click=${() => seekLists(1)}
              >
                <app-icon name="next"></app-icon>
              </button>
            </p>
            <p>
              <button
                type="button"
                class="app-button -circle -xl add"
                title="Add custom list"
                @click=${onAddList}
              >
                <app-icon name="addList"></app-icon>
              </button>
            </p>
          </div>
        </div>
      `,
      el,
    );

    container = el.querySelector<HTMLElement>(".todo-app > .content");

    if (!container) {
      throw new Error("Unable to mount todo app: list container is missing");
    }
  }

  // Provides a way to manage each card's lifecycle and maintain state.
  const cardControllers = new Map<string, TodoListCardController>();

  function updateCardPositions() {
    listIds.forEach((listId, index) => {
      cardControllers.get(listId)?.setPosition(index - currentListIndex);
    });
  }

  function seekLists(delta: number) {
    if (listIds.length === 0) {
      return;
    }

    currentListIndex = Math.max(0, Math.min(listIds.length - 1, currentListIndex + delta));
    updateCardPositions();
  }

  function getVisibleCardCount(listContainer: HTMLElement) {
    const firstCard = listContainer.firstElementChild;
    if (!(firstCard instanceof HTMLElement) || firstCard.offsetWidth === 0) {
      return 1;
    }

    return Math.max(1, Math.floor(listContainer.clientWidth / firstCard.offsetWidth));
  }

  /*
    TodoListCard owns its card DOM, event listeners, and interaction state.
    Keeps one controller per list ID so database updates call update() on the
    existing card instead of letting the parent Lit render recreate it.

    Note: This preserves focused inputs and editing state while giving removed
    cards an explicit destroy() lifecycle. TodoApp owns the outer frame and
    reconciles the card list; TodoListCard owns each card's DOM.
  */
  function renderLists(rows: ListWithTodoRow[]) {
    if (!container) {
      throw new Error("Unable to render todo lists: list container is missing");
    }
    const listContainer = container;
    const lists = mapTodoLists(rows);
    const previousListIds = new Set(listIds);
    const newListIndex = hasReceivedListSnapshot
      ? lists.findIndex((list) => !previousListIds.has(list.id))
      : -1;

    listIds = lists.map((list) => list.id);
    currentListIndex = Math.min(currentListIndex, Math.max(0, listIds.length - 1));

    // The active card IDs are calculated from the latest database query results.
    const activeListIds = new Set(lists.map((list) => list.id));

    for (const [listId, controller] of cardControllers) {
      // Delete - Any card not the active set will be removed from the DOM and destroyed.
      if (!activeListIds.has(listId)) {
        controller.destroy();
        controller.element.remove();
        cardControllers.delete(listId);
      }
    }

    // Inserts each card in the order supplied by the SQL query.
    lists.forEach((list, index) => {
      let controller = cardControllers.get(list.id);

      // Add - If a list item (card) is not already in cardControllers, a new TodoListCard()
      // is mounted and added to the map.
      if (!controller) {
        const card = document.createElement("div");

        controller = TodoListCard(card, list, index - currentListIndex, {
          onSubmit,
          onCompleted,
          onRename,
          onDelete,
        });

        cardControllers.set(list.id, controller);
      } else {
        controller.update(list, index - currentListIndex);
      }

      /*
        insertBefore() moves an existing DOM element; it does not clone it or create a duplicate.
        Because the loop processes lists in SQL order, inserting each card at its expected index
        keeps the DOM order synchronized with the database order.

          lists = [A, B, C]

          insertBefore(A, null) -> A
          insertBefore(B, null) -> A, B
          insertBefore(C, null) -> A, B, C

        Cards already at the expected index are not moved. This avoids unnecessary DOM work and
        prevents DevTools from highlighting the entire container subtree on every data update.
      */
      const cardAtIndex = listContainer.children[index];
      if (cardAtIndex !== controller.element) {
        listContainer.insertBefore(controller.element, cardAtIndex ?? null);
      }
    });

    if (newListIndex >= 0) {
      const visibleCardCount = getVisibleCardCount(listContainer);
      const firstVisibleIndex = currentListIndex;
      const lastVisibleIndex = currentListIndex + visibleCardCount - 1;

      if (newListIndex < firstVisibleIndex || newListIndex > lastVisibleIndex) {
        currentListIndex = newListIndex;
      }
    }

    updateCardPositions();
    hasReceivedListSnapshot = true;
  }

  renderComponent();

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
