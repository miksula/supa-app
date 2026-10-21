import { html, nothing, render } from "lit";
import "./my-todos.css";
import type { Dispose } from "@/types.ts";
import "@/ui/AppIcon.ts";
import { TodoListCard, type TodoListCardController } from "./TodoListCard.ts";
import { mapTodoLists, type ListWithTodoRow, type TodoStore } from "./TodoStore.ts";

export type MyTodosDependencies = {
  store: Pick<
    TodoStore,
    | "watchUserLists"
    | "createTodo"
    | "setTodoCompleted"
    | "createList"
    | "updateListName"
    | "deleteList"
  >;
  getUserId: () => string | null;
};

export function MyTodos(el: HTMLElement, { store, getUserId }: MyTodosDependencies): Dispose {
  const abortController = new AbortController();
  const cardControllers = new Map<string, TodoListCardController>();

  let container: HTMLElement | null = null;
  let previousButton: HTMLButtonElement | null = null;
  let nextButton: HTMLButtonElement | null = null;
  let listIds: string[] = [];
  let carouselIndex = 0;
  let lastObservedWidth = 0;
  let resizeObserver: ResizeObserver | null = null;
  let animationTimer: ReturnType<typeof setTimeout> | null = null;
  let hasReceivedListSnapshot = false;

  const getColumns = (): number => {
    if (!container) return 1;
    const firstCard = container.firstElementChild as HTMLElement | null;
    if (firstCard && firstCard.offsetWidth > 0 && container.offsetWidth > 0) {
      return Math.max(1, Math.round(container.offsetWidth / firstCard.offsetWidth));
    }
    const width = container.offsetWidth;
    if (width >= 80 * 16) return 4;
    if (width >= 60 * 16) return 3;
    if (width >= 40 * 16) return 2;
    return 1;
  };

  const getMaxIndex = (): number => {
    return Math.max(0, listIds.length - getColumns());
  };

  const updateNavigation = () => {
    const maxIndex = getMaxIndex();
    if (previousButton) previousButton.disabled = carouselIndex <= 0;
    if (nextButton) nextButton.disabled = carouselIndex >= maxIndex;
  };

  const updatePositions = () => {
    if (!container) return;
    const columns = getColumns();
    const maxIndex = getMaxIndex();
    carouselIndex = Math.max(0, Math.min(maxIndex, carouselIndex));

    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      const position = i - carouselIndex;

      child.style.transform = `translateX(${position * 100}%)`;
      child.inert = position < 0 || position >= columns;
      child.hidden = false;
    }

    updateNavigation();
  };

  const updateHeight = () => {
    if (!container) return;
    let maxHeight = 280;

    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      child.style.height = "auto";
      maxHeight = Math.max(child.offsetHeight, maxHeight);
    }

    container.style.height = `${maxHeight}px`;

    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      child.style.height = `${maxHeight}px`;
    }
  };

  const seek = (delta: number) => {
    const maxIndex = getMaxIndex();
    carouselIndex = Math.max(0, Math.min(maxIndex, carouselIndex + delta));
    updatePositions();
  };

  render(
    html`
      <div class="my-todos" data-component="my-todos">
        <div class="toolbar">
          <div class="navigation-controls">
            <button
              class="navigation-button"
              type="button"
              data-action="previous"
              aria-label="Previous"
              title="Previous"
            >
              <app-icon name="previous" size="18"></app-icon>
            </button>
            <button
              class="navigation-button"
              type="button"
              data-action="next"
              aria-label="Next"
              title="Next"
            >
              <app-icon name="next" size="18"></app-icon>
            </button>
          </div>
          <div class="toolbar-action">
            <button
              class="action-button"
              type="button"
              aria-label="Create a new list"
              title="Create a new list"
            >
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
  previousButton = root?.querySelector<HTMLButtonElement>('[data-action="previous"]') ?? null;
  nextButton = root?.querySelector<HTMLButtonElement>('[data-action="next"]') ?? null;

  const addListButton = root?.querySelector<HTMLButtonElement>('[aria-label="Create a new list"]');

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
      await store.createTodo({
        description,
        listId,
        createdBy: getUserId(),
      });
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
    const userId = getUserId();
    void store.setTodoCompleted(todoId, completed, userId).catch((error: unknown) => {
      checkbox.checked = !completed;
      console.error("Failed to update todo completion", error);
    });
  };

  const onAddList = async () => {
    const ownerId = getUserId();
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
    carouselIndex = Math.min(carouselIndex, getMaxIndex());

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
      const columns = getColumns();
      const maxIndex = Math.max(0, listIds.length - columns);
      carouselIndex = Math.max(0, Math.min(maxIndex, newListIndex - columns + 1));
    }

    updatePositions();
    updateHeight();
    hasReceivedListSnapshot = true;
  };

  const onResize = () => {
    updatePositions();
    updateHeight();
  };

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          const width = entry.contentRect.width;
          if (Math.abs(width - lastObservedWidth) > 1) {
            lastObservedWidth = width;
            onResize();
          }
        }
      }
    });
    if (container) resizeObserver.observe(container);
  }

  previousButton.addEventListener("click", () => seek(-1));
  nextButton.addEventListener("click", () => seek(1));

  addListButton.addEventListener("click", onAddList);
  window.addEventListener("resize", onResize);

  animationTimer = setTimeout(() => {
    container?.classList.add("-is-animated");
  }, 100);

  updatePositions();
  updateHeight();

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
    if (abortController.signal.aborted) return;
    abortController.abort();
    if (animationTimer) clearTimeout(animationTimer);
    resizeObserver?.disconnect();
    window.removeEventListener("resize", onResize);
    for (const controller of cardControllers.values()) {
      controller.destroy();
      controller.element.remove();
    }
    cardControllers.clear();
    render(nothing, el);
  };
}
