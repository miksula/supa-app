import { html, nothing, render } from "lit";
import { isDarkModeActive, setColorScheme, type ThemeScheme } from "@/theme/theme.ts";
import type { Dispose } from "@/types.ts";
import "./theme-switcher.css";

const SCHEMES: { scheme: ThemeScheme; label: string }[] = [
  { scheme: "light", label: "Light" },
  { scheme: "dark", label: "Dark" },
];

export function ThemeSwitcher(el: HTMLElement): Dispose {
  let disposed = false;
  const selectScheme = (scheme: ThemeScheme) => {
    setColorScheme(scheme);
    renderComponent();
  };
  const renderComponent = () => {
    if (disposed) return;
    const activeScheme: ThemeScheme = isDarkModeActive() ? "dark" : "light";
    render(
      html`
        <div class="theme-switcher" role="group" aria-label="Theme selection">
          <span class="label">Theme:</span>
          ${SCHEMES.map(({ scheme, label }) => {
            const isActive = scheme === activeScheme;
            return html`<button
              type="button"
              class="theme-btn ${isActive ? "-is-active" : ""}"
              aria-pressed="${isActive}"
              @click="${() => selectScheme(scheme)}"
            >
              ${label}
            </button>`;
          })}
        </div>
      `,
      el,
    );
  };
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  colorSchemeQuery.addEventListener("change", renderComponent);
  renderComponent();

  return () => {
    if (disposed) return;
    disposed = true;
    colorSchemeQuery.removeEventListener("change", renderComponent);
    render(nothing, el);
  };
}
