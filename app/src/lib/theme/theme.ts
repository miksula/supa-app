export type ThemeScheme = "light" | "dark";

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

export function initializeTheme() {
  const storedScheme = localStorage.getItem("color-scheme");
  if (storedScheme === "dark" || storedScheme === "light") setColorScheme(storedScheme);
}
