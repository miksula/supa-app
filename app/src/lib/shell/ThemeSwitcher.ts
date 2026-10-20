import { html, nothing, render } from "lit";
import {
  darkThemes,
  lightThemes,
  getActiveTheme,
  isDarkModeActive,
  setActiveTheme,
  setColorScheme,
  type ThemeOption,
} from "@/theme/theme.ts";
import type { Dispose } from "@/types.ts";
import "./theme-switcher.css";

export function ThemeSwitcher(el: HTMLElement): Dispose {
  let disposed = false;
  const selectTheme = (theme: ThemeOption) => {
    setActiveTheme(theme);
    setColorScheme(theme.scheme);
    renderComponent();
  };
  const renderComponent = () => {
    if (disposed) return;
    const isDark = isDarkModeActive();
    const activeLightTheme = getActiveTheme("light", lightThemes);
    const activeDarkTheme = getActiveTheme("dark", darkThemes);
    render(
      html`
        <div class="theme-switcher" role="group" aria-label="Theme selection">
          <span class="label">Theme:</span>
          ${[...lightThemes, ...darkThemes].map((theme) => {
            const isActive =
              theme.scheme === "dark"
                ? isDark && activeDarkTheme === theme.id
                : !isDark && activeLightTheme === theme.id;
            return html`<button
              type="button"
              class="theme-btn ${isActive ? "-is-active" : ""}"
              aria-pressed="${isActive}"
              @click="${() => selectTheme(theme)}"
            >
              ${theme.label}
            </button>`;
          })}
        </div>
      `,
      el,
    );
  };
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  colorSchemeQuery.addEventListener("change", renderComponent);
  const observer = new MutationObserver(renderComponent);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "data-light-theme", "data-dark-theme"],
  });
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) observer.observe(meta, { attributes: true, attributeFilter: ["content"] });
  renderComponent();

  return () => {
    if (disposed) return;
    disposed = true;
    colorSchemeQuery.removeEventListener("change", renderComponent);
    observer.disconnect();
    render(nothing, el);
  };
}
