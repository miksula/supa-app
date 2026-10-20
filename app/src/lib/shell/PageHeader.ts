import { html, nothing, render } from "lit";
import "./page-header.css";
import type { Dispose, RouteSource } from "@/types.ts";
import { resolveBreadcrumbs, type BreadcrumbItem } from "@/nav/breadcrumb.ts";
import "@/ui/AppIcon.ts";

export function PageHeader(el: HTMLElement, router: RouteSource): Dispose {
  let disposed = false;

  let breadcrumbs: BreadcrumbItem[] = resolveBreadcrumbs(router.path);

  const renderComponent = () => {
    if (disposed) return;
    render(
      html`
        <header data-component="page-header" class="page-header">
          <div class="header-left">
            <button
              class="sidebar-trigger"
              data-slot="sidebar-trigger"
              data-sidebar="trigger"
              aria-label="Avaa tai sulje sivupalkki"
              type="button"
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
                <path d="M9 3v18"></path>
              </svg>
              <span class="sr-only">Avaa tai sulje sivupalkki</span>
            </button>

            <div class="header-separator" role="separator" aria-orientation="vertical"></div>

            <nav aria-label="Sijaintipolku" class="breadcrumbs">
              <ol class="breadcrumb-list">
                ${breadcrumbs.map((item, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return html`
                    <li class="breadcrumb-item">
                      ${
                        item.url && !isLast
                          ? html`<a href="${item.url}" class="breadcrumb-link">${item.label}</a>`
                          : html`<span
                              class="breadcrumb-page ${isLast ? "-is-current" : ""}"
                              aria-current="${isLast ? "page" : "false"}"
                              >${item.label}</span
                            >`
                      }
                    </li>
                    ${
                      !isLast
                        ? html`
                            <li class="breadcrumb-separator" aria-hidden="true">
                              <app-icon name="next" size="14"></app-icon>
                            </li>
                          `
                        : ""
                    }
                  `;
                })}
              </ol>
            </nav>
          </div>

          <div class="header-actions" data-slot="header-actions"></div>
        </header>
      `,
      el,
    );
  };

  const handleRouteChange = (newPath: string) => {
    breadcrumbs = resolveBreadcrumbs(newPath);
    renderComponent();
  };

  router.addRouteListener(handleRouteChange);

  renderComponent();

  return () => {
    if (disposed) return;
    disposed = true;
    router.removeRouteListener(handleRouteChange);
    render(nothing, el);
  };
}
