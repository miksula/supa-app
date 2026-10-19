import { html } from "lit";

export function PageHeader() {
  return html`
    <header data-component="page-header" class="flex h-16 shrink-0 items-center gap-2">
      <div class="flex items-center gap-2 px-4">
        <button
          class="sidebar-trigger"
          data-slot="sidebar-trigger"
          data-sidebar="trigger"
          aria-label="Toggle Sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-panel-left"
          >
            <rect width="18" height="18" x="3" y="3" rx="2"></rect>
            <path d="M9 3v18"></path></svg
          ><span class="sr-only">Toggle Sidebar</span>
        </button>
      </div>
    </header>
  `;
}
