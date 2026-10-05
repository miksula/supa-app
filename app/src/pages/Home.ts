import { html, render } from "lit";
// import { TodoApp } from "@/components/TodoApp.js";

export function Home(el) {
  render(
    html`
      <div class="home-page">
        <h1>Welcome to Supa App</h1>
      </div>
    `,
    el,
  );
  // TodoApp(el.querySelector(".home-page"));
}
