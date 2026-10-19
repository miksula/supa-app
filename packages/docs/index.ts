const rawDocModules = import.meta.glob<string>("./*.md", {
  query: "?raw",
  import: "default",
});

export const availableDocIds: string[] = Object.keys(rawDocModules)
  .map((path) => path.replace(/^\.\//, "").replace(/\.md$/, ""))
  .sort();

export async function getDocContent(id: string): Promise<string | null> {
  const cleanId = id.replace(/^\/+/, "").replace(/\.md$/, "");
  const normalizedKey = `./${cleanId}.md`;
  const loader = rawDocModules[normalizedKey];

  if (!loader) {
    return null;
  }

  return await loader();
}
