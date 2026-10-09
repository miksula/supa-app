import { html, render } from "lit";
import { powersync } from "@/lib/client.ts";
import { TodoStore, type Todo } from "@/lib/TodoStore.ts";

export function TodoApp(
  el: HTMLElement,
  listId: string,
  store = new TodoStore(powersync),
) {
  const abortController = new AbortController();

  function renderComponent(todos: Todo[] = []) {
    render(
      html`
        <div class="todo-app">
          <h1>Todo App</h1>
          <ul class="todo-list">
            ${todos.map((todo) => html`<li>${todo.description}</li>`)}
          </ul>
        </div>
      `,
      el,
    );
  }

  renderComponent();

  void (async () => {
    try {
      for await (
        const result of store.watchUserTodos(listId, {
          signal: abortController.signal,
        })
      ) {
        if (!abortController.signal.aborted) {
          renderComponent(result.array as Todo[]);
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
