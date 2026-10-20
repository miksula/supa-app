import { html, nothing, render } from "lit";
import "@/ui/AppIcon.ts";
import { authService } from "@/auth/auth.ts";
import { powersync } from "@/sync/client.ts";
import { TodoListCard, type TodoListCardController } from "./TodoListCard.ts";
import { mapTodoLists, type ListWithTodoRow, TodoStore } from "./TodoStore.ts";

export function MyTodos(el: HTMLElement, store = new TodoStore(powersync)) {
  const abortController = new AbortController();
  const cardControllers = new Map<string, TodoListCardController>();
  const desktopQuery = window.matchMedia("(width >= 48rem)");

  let container: HTMLElement | null = null;
  let previousButton: HTMLButtonElement | null = null;
  let nextButton: HTMLButtonElement | null = null;
  let listIds: string[] = [];
  let pageIndex = 0;
  let hasReceivedListSnapshot = false;

  // Provides a way to manage each card's lifecycle and maintain state.
  // Each controller keeps its card DOM and interaction state across database updates.
  const pageSize = () => (desktopQuery.matches ? 3 : 1);
  const pageCount = () => Math.max(1, Math.ceil(listIds.length / pageSize()));

  const updateNavigation = () => {
    if (previousButton) previousButton.disabled = pageIndex === 0;
    if (nextButton) nextButton.disabled = pageIndex >= pageCount() - 1;
  };

  const applyPaging = () => {
    pageIndex = Math.max(0, Math.min(pageIndex, pageCount() - 1));
    const start = pageIndex * pageSize();
    const end = start + pageSize();

    listIds.forEach((listId, index) => {
      const card = cardControllers.get(listId);
      if (card) card.element.hidden = index < start || index >= end;
    });

    updateNavigation();
  };

  const seekPage = (delta: number) => {
    pageIndex += delta;
    applyPaging();
  };

  render(
    html`
      <div class="my-todos" data-component="my-todos">
        <div class="toolbar">
          <div class="navigation-controls">
            <button class="navigation-button" type="button" aria-label="Previous page">
              <app-icon name="previous" size="18"></app-icon>
            </button>
            <button class="navigation-button" type="button" aria-label="Next page">
              <app-icon name="next" size="18"></app-icon>
            </button>
          </div>
          <div class="toolbar-action">
            <button class="action-button" type="button" aria-label="Create new list">
              <app-icon name="squarePen" size="16"></app-icon>
            </button>
          </div>
        </div>
        <div class="todo-list-container"></div>
      </div>
    `,
    el,
  );

  const root = el.querySelector<HTMLElement>('[data-component="my-todos"]');
  container = root?.querySelector<HTMLElement>(".todo-list-container") ?? null;
  previousButton = root?.querySelector<HTMLButtonElement>('[aria-label="Previous page"]') ?? null;
  nextButton = root?.querySelector<HTMLButtonElement>('[aria-label="Next page"]') ?? null;

  const addListButton = root?.querySelector<HTMLButtonElement>('[aria-label="Create new list"]');

  if (!container || !previousButton || !nextButton || !addListButton) {
    throw new Error("Unable to mount my todos: required element is missing");
  }

  const onSubmit = async (event: SubmitEvent, listId: string) => {
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
  };

  const onCompleted = (event: Event, todoId: string) => {
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
  };

  const onAddList = async () => {
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
  };

  const onRename = async (listId: string, name: string) => {
    await store.updateListName(listId, name);
  };
  const onDelete = async (listId: string) => {
    await store.deleteList(listId);
  };

  const renderLists = (rows: ListWithTodoRow[]) => {
    const lists = mapTodoLists(rows);
    const previousListIds = new Set(listIds);
    const newListIndex = hasReceivedListSnapshot
      ? lists.findIndex((list) => !previousListIds.has(list.id))
      : -1;

    listIds = lists.map((list) => list.id);
    pageIndex = Math.min(pageIndex, Math.max(0, pageCount() - 1));

    /*
      TodoListCard owns its card DOM, event listeners, and interaction state.
      Keeps one controller per list ID so database updates call update() on the
      existing card instead of letting the parent Lit render recreate it.

      Note: This preserves focused inputs and editing state while giving removed
      cards an explicit destroy() lifecycle. MyTodos owns the outer frame and
      reconciles the card list; TodoListCard owns each card's DOM.
    */

    // The active card IDs are calculated from the latest database query results.
    const activeListIds = new Set(listIds);
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
        const card = document.createElement("article");
        controller = TodoListCard(card, list, {
          onSubmit,
          onCompleted,
          onRename,
          onDelete,
        });
        cardControllers.set(list.id, controller);
      } else {
        controller.update(list);
      }

      /*
        insertBefore() moves an existing DOM element; it does not clone or create a duplicate.
        Because the loop processes lists in SQL order, inserting each card at its expected index
        keeps the DOM order synchronized with the database order.

          lists = [A, B, C]

          insertBefore(A, null) -> A
          insertBefore(B, null) -> A, B
          insertBefore(C, null) -> A, B, C

        Cards already at the expected index are not moved. This avoids unnecessary DOM work and
        prevents DevTools from highlighting the entire container subtree on every data update.
      */
      const cardAtIndex = container?.children[index];
      if (cardAtIndex !== controller.element) {
        container?.insertBefore(controller.element, cardAtIndex ?? null);
      }
    });

    if (newListIndex >= 0) {
      pageIndex = Math.floor(newListIndex / pageSize());
    }

    applyPaging();
    hasReceivedListSnapshot = true;
  };

  const onMediaChange = () => {
    const firstVisibleList = pageIndex * (desktopQuery.matches ? 3 : 1);
    pageIndex = Math.floor(firstVisibleList / pageSize());
    applyPaging();
  };

  previousButton.addEventListener("click", () => seekPage(-1));
  nextButton.addEventListener("click", () => seekPage(1));

  addListButton.addEventListener("click", onAddList);
  desktopQuery.addEventListener("change", onMediaChange);

  applyPaging();

  void (async () => {
    try {
      for await (const result of store.watchUserLists({ signal: abortController.signal })) {
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

  return () => {
    abortController.abort();
    desktopQuery.removeEventListener("change", onMediaChange);
    for (const controller of cardControllers.values()) {
      controller.destroy();
      controller.element.remove();
    }
    cardControllers.clear();
    render(nothing, el);
  };
}
