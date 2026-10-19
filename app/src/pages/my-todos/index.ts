import { html, render } from "lit";

export function MyTodosPage(target: HTMLElement) {
  const renderComponent = () => {
    render(html` <div>mytodos</div> `, target);
  };

  renderComponent();
}
