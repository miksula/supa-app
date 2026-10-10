import { html, render } from "lit";
import { powersync } from "@/lib/client.ts";
import { type List, type Todo, type ListWithTodos, TodoStore } from "@/lib/TodoStore.ts";

type TodoList = List & {
  items: Todo[];
};

const mapTodoLists = (lists: ListWithTodos[]): TodoList[] => {
  return lists.map((list) => ({
    ...list,
    items: list.items ? JSON.parse(list.items) : [],
  }));
};

export function TodoApp(el: HTMLElement, store = new TodoStore(powersync)) {
  const abortController = new AbortController();

  function renderComponent(lists: ListWithTodos[] = []) {
    console.log("Rendering component with lists:", mapTodoLists(lists));
    render(
      html`
        <div class="todo-app">
          <h1>Todo App</h1>
          <div class="todo-lists">
            ${mapTodoLists(lists).map(
              (list) =>
                html`<ul>
                  ${list.name} ${list.items.map((todo: any) => html`<li>${todo.description}</li>`)}
                </ul>`,
            )}
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
          renderComponent(result.array as ListWithTodos[]);
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
