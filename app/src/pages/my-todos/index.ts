import { html, render } from "lit";

export function MyTodosPage(target: HTMLElement) {
  const renderComponent = () => {
    render(
      html`
        <div class="my-todos-page" data-component="my-todos-page">
          <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div class="grid auto-rows-min gap-4 md:grid-cols-3">
              <div class="aspect-video rounded-xl bg-(--surface-raised)/50"></div>
              <div class="aspect-video rounded-xl bg-(--surface-raised)/50"></div>
              <div class="aspect-video rounded-xl bg-(--surface-raised)/50"></div>
            </div>
            <div class="min-h-screen flex-1 rounded-xl bg-(--surface-raised)/50 md:min-h-min"></div>
          </div>
        </div>
      `,
      target,
    );
  };

  renderComponent();
}
