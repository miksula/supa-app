import { html, render } from "lit";
import "./AppIcon.ts";

export function Sidebar(target: HTMLElement) {
  const renderComponent = () => {
    render(
      html`
        <div class="sidebar">
          <div class="header">
            <a href="#" class="flex items-center">
              <div class="icon-container">
                <app-icon name="command" size="16"></app-icon>
              </div>
            </a>
            <div class="text-container font-normal">
              <span class="truncate text-sm">Local First</span>
              <span class="truncate text-xs">Supabase</span>
            </div>
          </div>
          <nav class="content">
            <div class="group">
              <div class="label flex items-center  h-8 text-xs font-medium">Platform</div>
              <ul class="menu">
                <li></li>
              </ul>
            </div>
          </nav>
        </div>
      `,
      target,
    );
  };

  renderComponent();
}
