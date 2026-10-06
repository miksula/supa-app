import { html, render } from "lit";

export function TodoApp(el: HTMLElement) {
  function renderComponent() {
    render(
      html`
        <div class="todo-app">
          <h1>Todo App</h1>
          <div class="todo-list"></div>
        </div>
      `,
      el,
    );
  }

  renderComponent();
}
