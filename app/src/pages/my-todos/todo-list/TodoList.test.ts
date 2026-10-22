/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, nothing } from "lit";
import { TodoList, type TodoListOptions } from "./TodoList.ts";
import type { Todo } from "../TodoStore.ts";

vi.mock("@/ui/AppIcon.ts", () => ({}));

const todo = { id: "todo-1", description: "Buy milk", completed: 0 } as Todo;

function setup(options: Partial<TodoListOptions> = {}) {
  const el = document.createElement("div");
  document.body.append(el);
  const callbacks: TodoListOptions = {
    onAddTodo: vi.fn(() => Promise.resolve()),
    onToggleTodo: vi.fn(() => Promise.resolve()),
    ...options,
  };
  TodoList(el, { id: "list-1", items: [todo] }, callbacks);

  const form = el.querySelector("form")!;
  const input = el.querySelector<HTMLInputElement>('input[name="description"]')!;
  const checkbox = el.querySelector<HTMLInputElement>(".todo-item-checkbox")!;
  return { el, form, input, checkbox, callbacks };
}

const submit = (form: HTMLFormElement) =>
  form.dispatchEvent(new Event("submit", { cancelable: true }));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

describe("TodoList", () => {
  afterEach(() => {
    for (const el of document.body.children) render(nothing, el as HTMLElement);
    document.body.replaceChildren();
  });

  it("passes the trimmed description and resets the form on success", async () => {
    const { form, input, callbacks } = setup();
    input.value = "  Walk the dog  ";

    submit(form);
    await flushPromises();

    expect(callbacks.onAddTodo).toHaveBeenCalledWith("list-1", "Walk the dog");
    expect(input.value).toBe("");
  });

  it("ignores a blank description and focuses the input", () => {
    const { form, input, callbacks } = setup();
    input.value = "   ";

    submit(form);

    expect(callbacks.onAddTodo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it("keeps the typed text when adding fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { form, input } = setup({ onAddTodo: () => Promise.reject(new Error("offline")) });
    input.value = "Walk the dog";

    submit(form);
    await flushPromises();

    expect(input.value).toBe("Walk the dog");
    expect(console.error).toHaveBeenCalledWith("Failed to create todo", expect.any(Error));
  });

  it("passes the new completed state when toggled", () => {
    const { checkbox, callbacks } = setup();

    checkbox.click();

    expect(callbacks.onToggleTodo).toHaveBeenCalledWith("todo-1", true);
  });

  it("reverts the checkbox when toggling fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { checkbox } = setup({ onToggleTodo: () => Promise.reject(new Error("offline")) });

    checkbox.click();
    expect(checkbox.checked).toBe(true);
    await flushPromises();

    expect(checkbox.checked).toBe(false);
  });
});
