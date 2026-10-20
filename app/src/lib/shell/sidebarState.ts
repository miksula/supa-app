const SIDEBAR_STORAGE_KEY = "sidebar_state";

export function getInitialOpenState(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveOpenState(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  } catch {}
}
