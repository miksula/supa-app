// Paste into the DevTools console on the app origin (e.g. http://localhost:5173).
// Deletes the PowerSync OPFS database files (supa-app.db, -journal, -wal, ...).
// Close every tab of this origin first, or the delete fails with NoModificationAllowedError.
(async () => {
  const root = await navigator.storage.getDirectory();
  const names = [];
  for await (const name of root.keys()) names.push(name);
  console.log("OPFS root entries before:", names);

  const targets = names.filter((name) => name.startsWith("supa-app.db"));
  for (const name of targets) {
    try {
      await root.removeEntry(name, { recursive: true });
      console.log("Removed:", name);
    } catch (error) {
      console.error("Failed to remove", name, error.name, error.message);
    }
  }

  if (targets.length === 0) console.log("No supa-app.db files found.");
})();
