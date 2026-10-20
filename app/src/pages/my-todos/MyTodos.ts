import { html } from "lit";
import "@/ui/AppIcon.ts";

export function MyTodos() {
  const renderComponent = () => html`
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
          <button class="action-button" type="button" aria-label="Create new todo">
            <app-icon name="squarePen" size="16"></app-icon>
          </button>
        </div>
      </div>
      <div class="todo-list-container">
        <div class="todo-list-placeholder">
          <div class="font-normal text-xs p-2 m-2 rounded-md">Add Playwright test harness</div>
        </div>
        <div class="todo-list-placeholder"></div>
      </div>
    </div>
  `;

  return renderComponent();
}
