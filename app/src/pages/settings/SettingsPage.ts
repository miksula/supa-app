import { html, nothing, render } from "lit";
import "./settings.css";
import type { Dispose } from "@/types.ts";
import { TodoBackupError } from "../my-todos/todoBackup.ts";
import type { TodoStore } from "../my-todos/TodoStore.ts";
import { downloadJson, readJsonFile } from "./backupFile.ts";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type SettingsDependencies = {
  backup: Pick<TodoStore, "exportData" | "importData">;
  getUserId: () => string | null;
  canImport: boolean;
};

type Feedback = {
  kind: "status" | "alert";
  message: string;
};

function formatDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function SettingsPage(
  el: HTMLElement,
  { backup, getUserId, canImport }: SettingsDependencies,
): Dispose {
  let disposed = false;
  let isBusy = false;
  let feedback: Feedback | null = null;

  const setFeedback = (next: Feedback | null) => {
    feedback = next;
    renderComponent();
  };

  async function handleExport() {
    if (disposed || isBusy) return;
    isBusy = true;
    feedback = null;
    renderComponent();

    try {
      const data = await backup.exportData();
      if (disposed) return;
      const filename = `supa-todos-backup-${formatDateStamp()}.json`;
      downloadJson(data, filename);
      setFeedback({ kind: "status", message: `Exported ${filename}.` });
    } catch (error) {
      if (disposed) return;
      console.error("Failed to export data", error);
      const message = error instanceof Error ? error.message : "Failed to export data.";
      setFeedback({ kind: "alert", message });
    } finally {
      isBusy = false;
      renderComponent();
    }
  }

  function openFilePicker() {
    if (disposed || isBusy) return;
    const input = el.querySelector<HTMLInputElement>('input[type="file"]');
    input?.click();
  }

  async function handleFileChange(event: Event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = "";
    if (!file || disposed || isBusy) return;

    const userId = getUserId();
    if (!userId) {
      setFeedback({ kind: "alert", message: "Sign in before importing a backup." });
      return;
    }

    isBusy = true;
    feedback = null;
    renderComponent();

    try {
      const parsed = await readJsonFile(file, MAX_IMPORT_BYTES);
      if (disposed) return;
      const counts = await backup.importData(parsed, { userId });
      if (disposed) return;
      setFeedback({
        kind: "status",
        message: `Imported ${counts.lists} lists and ${counts.todos} todos.`,
      });
    } catch (error) {
      if (disposed) return;
      console.error("Failed to import data", error);
      const message =
        error instanceof TodoBackupError
          ? error.issues.join("; ")
          : error instanceof Error
            ? error.message
            : "Failed to import data.";
      setFeedback({ kind: "alert", message });
    } finally {
      isBusy = false;
      renderComponent();
    }
  }

  const renderComponent = () => {
    if (disposed) return;
    render(
      html`
        <div class="settings-page" data-component="settings-page">
          <div class="settings-container">
            <header class="settings-header">
              <h1 class="settings-title">Settings</h1>
              <p class="settings-subtitle">Manage your local data and backups.</p>
            </header>

            <section class="settings-section" aria-labelledby="backup-heading">
              <div class="section-header">
                <h2 id="backup-heading" class="section-title">Backup</h2>
              </div>

              <div class="backup-row">
                <div class="backup-copy">
                  <h3 class="backup-label">Export data</h3>
                  <p class="backup-description">
                    Exports the lists and todos stored on this device.
                  </p>
                </div>
                <button
                  class="backup-button"
                  type="button"
                  data-action="export"
                  ?disabled="${isBusy}"
                  @click="${handleExport}"
                >
                  Export data
                </button>
              </div>

              <div class="backup-row">
                <div class="backup-copy">
                  <h3 class="backup-label">Import data</h3>
                  <p class="backup-description">
                    ${
                      canImport
                        ? "Rows with the same ID are overwritten."
                        : "Import is available in Local-Only Mode."
                    }
                  </p>
                </div>
                ${
                  canImport
                    ? html`
                        <input
                          class="backup-file-input"
                          type="file"
                          accept="application/json,.json"
                          ?disabled="${isBusy}"
                          @change="${handleFileChange}"
                        />
                        <button
                          class="backup-button"
                          type="button"
                          data-action="import"
                          ?disabled="${isBusy}"
                          @click="${openFilePicker}"
                        >
                          Import data
                        </button>
                      `
                    : nothing
                }
              </div>

              ${
                feedback
                  ? html`
                      <p
                        class="backup-feedback ${feedback.kind === "alert" ? "-is-alert" : "-is-status"}"
                        role="${feedback.kind}"
                      >
                        ${feedback.message}
                      </p>
                    `
                  : nothing
              }
            </section>
          </div>
        </div>
      `,
      el,
    );
  };

  renderComponent();

  return () => {
    if (disposed) return;
    disposed = true;
    render(nothing, el);
  };
}
