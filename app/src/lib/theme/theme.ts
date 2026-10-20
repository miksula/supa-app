export type ThemeScheme = "light" | "dark";
export type ThemeOption = { id: string; label: string; scheme: ThemeScheme };

export const lightThemes: ThemeOption[] = [{ id: "newyork", label: "Light", scheme: "light" }];
export const darkThemes: ThemeOption[] = [{ id: "newyork", label: "Dark", scheme: "dark" }];

export function resolveColorScheme(preference: string | null, prefersDark: boolean): ThemeScheme {
  return preference === "light" || preference === "dark"
    ? preference
    : prefersDark
      ? "dark"
      : "light";
}

export function isDarkModeActive(): boolean {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const preference =
    meta?.content === "dark" || meta?.content === "light"
      ? meta.content
      : document.documentElement.style.colorScheme;
  return (
    resolveColorScheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches) ===
    "dark"
  );
}

export function setColorScheme(scheme: ThemeScheme) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = scheme;
  document.documentElement.style.colorScheme = scheme;
  localStorage.setItem("color-scheme", scheme);
}

export function getActiveTheme(scheme: ThemeScheme, themes: ThemeOption[]) {
  const current = document.documentElement.getAttribute(`data-${scheme}-theme`);
  const stored = localStorage.getItem(`${scheme}-theme`);
  return (
    themes.find((theme) => theme.id === current)?.id ??
    themes.find((theme) => theme.id === stored)?.id ??
    themes[0].id
  );
}

export function setActiveTheme(theme: ThemeOption) {
  document.documentElement.setAttribute(`data-${theme.scheme}-theme`, theme.id);
  document.documentElement.setAttribute("data-theme", theme.id);
  localStorage.setItem(`${theme.scheme}-theme`, theme.id);
}

export function initializeTheme() {
  const storedScheme = localStorage.getItem("color-scheme");
  if (storedScheme === "dark" || storedScheme === "light") setColorScheme(storedScheme);
  const scheme = isDarkModeActive() ? "dark" : "light";
  const themes = scheme === "dark" ? darkThemes : lightThemes;
  document.documentElement.setAttribute("data-theme", getActiveTheme(scheme, themes));
}
