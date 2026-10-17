import { html, render } from "lit";

export function MyTodos(target: HTMLElement) {
  const renderComponent = () => {
    render(html` <div>mytodos</div> `, target);
  };

  renderComponent();
}
