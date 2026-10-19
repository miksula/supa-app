import { html, render } from "lit";
import "@/ui/AppIcon.ts";

export function MyTodosPage(target: HTMLElement) {
  const renderComponent = () => {
    render(
      html`
        <div class="my-todos-page" data-component="my-todos-page">
          <div class="page-content">
            <div class="page-toolbar">
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
            <div class="todo-grid">
              <div class="todo-placeholder"></div>
              <div class="todo-placeholder"></div>
            </div>
          </div>
        </div>
      `,
      target,
    );
  };

  renderComponent();
}
