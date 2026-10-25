/** Asks the browser not to evict this origin's storage (OPFS database included). */
export async function requestPersistentStorage() {
  try {
    if (await navigator.storage?.persisted?.()) return;
    await navigator.storage?.persist?.();
  } catch (error) {
    console.warn("Persistent storage request failed", error);
  }
}
