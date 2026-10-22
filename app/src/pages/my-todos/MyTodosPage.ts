import { html, nothing, render } from "lit";
import "./my-todos.css";
import type { Dispose } from "@/types.ts";
import "@/ui/AppIcon.ts";
import { Carousel } from "./Carousel.ts";
import {
  TodoListCard,
  type TodoListCardController,
  type TodoListCardOptions,
} from "./todo-list-card/TodoListCard.ts";
import { mapTodoLists, type ListWithTodoRow, type TodoStore } from "./TodoStore.ts";

export type MyTodosDependencies = {
  store: TodoStore;
  getUserId: () => string | null;
};

export function MyTodosPage(el: HTMLElement, { store, getUserId }: MyTodosDependencies): Dispose {
  const abortController = new AbortController();
  const cardsByListId = new Map<string, TodoListCardController>();
  let hasRenderedLists = false;

  render(
    html`
      <div class="my-todos-page" data-component="my-todos-page">
        <div class="toolbar">
          <div class="navigation-controls">
            <button
              class="navigation-button"
              type="button"
              data-action="previous"
              aria-controls="todo-list-track"
              aria-label="Previous"
              title="Previous"
            >
              <app-icon name="previous" size="18"></app-icon>
            </button>
            <button
              class="navigation-button"
              type="button"
              data-action="next"
              aria-controls="todo-list-track"
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
              data-action="add-list"
              aria-label="Create a new list"
              title="Create a new list"
            >
              <app-icon name="squarePen" size="16"></app-icon>
            </button>
          </div>
        </div>
        <div
          class="todo-list-track"
          id="todo-list-track"
          role="region"
          aria-label="Todo lists"
        ></div>
      </div>
    `,
    el,
  );

  const track = el.querySelector<HTMLElement>(".todo-list-track");
  const previousButton = el.querySelector<HTMLButtonElement>('[data-action="previous"]');
  const nextButton = el.querySelector<HTMLButtonElement>('[data-action="next"]');
  const addListButton = el.querySelector<HTMLButtonElement>('[data-action="add-list"]');

  if (!track || !previousButton || !nextButton || !addListButton) {
    throw new Error("Unable to mount my todos: required element is missing");
  }

  const carousel = Carousel(track, { previousButton, nextButton });

  const cardOptions: TodoListCardOptions = {
    onAddTodo: (listId, description) =>
      store.createTodo({ description, listId, createdBy: getUserId() }),
    onToggleTodo: (todoId, completed) => store.setTodoCompleted(todoId, completed, getUserId()),
    onRename: (listId, name) => store.updateListName(listId, name),
    onDelete: (listId) => store.deleteList(listId),
  };

  const addList = async () => {
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

  const removeCard = (listId: string, card: TodoListCardController) => {
    card.destroy();
    card.element.remove();
    cardsByListId.delete(listId);
  };

  /** Keyed update: reuses each list's card so in-progress edits survive data snapshots. */
  const syncCards = (rows: ListWithTodoRow[]) => {
    const lists = mapTodoLists(rows);
    const currentListIds = new Set(lists.map((list) => list.id));
    let addedCard: HTMLElement | null = null;

    for (const [listId, card] of cardsByListId) {
      if (!currentListIds.has(listId)) removeCard(listId, card);
    }

    lists.forEach((list, index) => {
      let card = cardsByListId.get(list.id);

      if (card) {
        card.update(list);
      } else {
        card = TodoListCard(document.createElement("article"), list, cardOptions);
        cardsByListId.set(list.id, card);
        if (hasRenderedLists) addedCard ??= card.element;
      }

      const elementAtIndex = track.children[index] ?? null;
      if (elementAtIndex !== card.element) track.insertBefore(card.element, elementAtIndex);
    });

    hasRenderedLists = true;
    carousel.refresh();
    if (addedCard) carousel.reveal(addedCard);
  };

  addListButton.addEventListener("click", addList);

  void (async () => {
    try {
      for await (const result of store.watchUserLists({ signal: abortController.signal })) {
        if (!abortController.signal.aborted) {
          syncCards(result.array as ListWithTodoRow[]);
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
    carousel.destroy();
    addListButton.removeEventListener("click", addList);
    for (const [listId, card] of cardsByListId) removeCard(listId, card);
    render(nothing, el);
  };
}
