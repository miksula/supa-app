import { html, render } from "lit";

import { router } from "@packages/router";
import { AppBar } from "@/lib/AppBar.ts";
import { AuthController } from "@/lib/AuthController.ts";
import { Home } from "@/pages/Home.ts";
import { Login } from "@/pages/Login.ts";

type MountFunction = (el: HTMLElement) => void;
type Layout = "app" | "login";

const appLayout = () =>
  html`
    <div class="app-shell app-layout">
      <header></header>
      <div class="content app-content"></div>
    </div>
  `;

const loginLayout = () =>
  html`
    <div class="app-shell">
      <div class="content login-content"></div>
    </div>
  `;

export function AppShell(el) {
  let route: { page: MountFunction; layout: Layout };
  const auth = new AuthController();

  router
    .get("/", () => {
      route = { page: Home, layout: "app" };
    })
    .get("/login", () => {
      route = { page: Login, layout: "login" };
    });

  router.addRouteListener(function renderRoute(path) {
    if (auth.enforceAuthRoute(path)) {
      return;
    }

    const { page, layout } = route;

    function updateDOM() {
      render(layout === "app" ? appLayout() : loginLayout(), el);

      if (layout === "app") {
        AppBar(el.querySelector(":scope > div > header"));
      }

      page(el.querySelector(":scope > div > .content"));
    }

    // Skip the transition on first paint, when there is no old view to animate from.
    if (!document.startViewTransition || !el.hasChildNodes()) {
      updateDOM();
      return;
    }

    document.startViewTransition(updateDOM);
  });

  void auth.bootstrap();
}
