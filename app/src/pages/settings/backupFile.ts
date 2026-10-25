export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export async function readJsonFile(file: File, maxBytes: number): Promise<unknown> {
  if (file.size > maxBytes) {
    throw new Error("Backup file exceeds the 10 MB size limit.");
  }
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Invalid JSON file.");
  }
}
