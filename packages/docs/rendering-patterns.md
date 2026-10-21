# Rendering patterns

Welcome to the UI rendering guide for Supa App. If you are coming from React, Vue,
or Svelte, this codebase might look pleasantly different: there is no virtual DOM,
no compiler magic, no heavyweight runtime framework, and no global state store.

Instead, the UI is built directly on web standards using three distinct component
patterns:

1. **Mounted Lit template functions** (declarative rendering into an existing element)
2. **Imperative functional components** (rigid DOM with a controller managing focus and updates)
3. **Reactive `LitElement` components** (autonomous custom Web Components)

All three patterns can render HTML and handle browser events. The critical distinction
is **where state lives, who owns the DOM, and how cleanup happens**.

This guide explains each pattern using real code from the application, shows how
they fit together, and helps you choose the right approach when building new features.

---

## The bedrock: Mount and cleanup contract

Before looking at the component patterns, you need to understand the lifecycle contract
that governs every piece of UI in this repository. It is defined in
`app/src/lib/types.ts`:

```ts
export type Dispose = () => void;
export type Mount<Props = void> = (el: HTMLElement, props: Props) => Dispose | void;
```

A **mount function** takes an existing host element and its props, renders content into
that element, attaches any necessary listeners or background subscriptions, and returns
a `Dispose` function.

Whoever mounts a component is responsible for saving its disposer and calling it before
replacing or discarding the host element:

```ts
// Mounting a component
const dispose = MountComponent(hostElement, props);

// Later, before replacing or removing hostElement from the DOM:
dispose?.();
```

### Why this contract matters

In single-page applications without a framework runtime managing component trees,
neglecting lifecycle cleanup causes subtle, severe bugs: leaked event listeners, orphan
database subscriptions, and async callbacks attempting to mutate unmounted DOM nodes.

In this codebase:

- **Layout transitions enforce cleanup**: The layout manager in `app/src/lib/layoutManager.ts`
  always invokes `disposePage()` before mounting the next route.
- **Async safety with `disposed` flags**: Components that perform asynchronous operations
  (such as `LoginPage` or `DocViewer`) keep an internal `disposed` boolean. If an async
  operation completes after the user has navigated away, the callback checks `disposed`
  and aborts immediately without touching the DOM.
- **Aborting background subscriptions**: Components that stream data from the local SQLite
  database (such as `MyTodos`) pass an `AbortSignal` to their queries and abort them in
  their disposer.
- **Never store disposers on DOM nodes**: Keep cleanup references inside component closures
  or controller maps, never on arbitrary element properties or `dataset` attributes.
- **Component CSS co-location**: Styles live beside their component (for example,
  `import "./todo-list-card.css"` or `import "./sidebar.css"`). Component CSS files use
  modern `@scope` and semantic tokens (see [Styling and CSS](./styling.md)), keeping
  global CSS small and predictable.

---

## 1. Mounted Lit template functions

A mounted Lit template function is a function that receives a target DOM element and
renders a declarative Lit template into it using Lit's standalone `html` tagged template
and `render()` function.

It requires **no custom element registration**, creates **no Shadow DOM**, and leaves the
host element completely in the caller's control.

### Real-world example: `TodoList`

`TodoList` (`app/src/pages/my-todos/TodoList.ts`) renders the interactive list of todos
and the input form inside each todo list card:

```ts
import { html, render } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "@/ui/AppIcon.ts";
import type { Todo } from "./TodoStore.ts";

export type TodoListOptions = {
  onSubmit: (event: SubmitEvent, listId: string) => void;
  onCompleted: (event: Event, todoId: string) => void;
};

function TodoItem(todo: Todo, onCompleted: TodoListOptions["onCompleted"]) {
  return html`
    <li class="todo-item ${todo.completed ? "-is-done" : ""}" data-key="${todo.id}">
      <label class="todo-item-row">
        <input
          type="checkbox"
          class="todo-item-checkbox"
          .checked=${Boolean(todo.completed)}
          @change=${(event: Event) => onCompleted(event, todo.id)}
        />
        <span class="todo-item-label">${todo.description}</span>
      </label>
    </li>
  `;
}

function TodoInput(listId: string, onSubmit: TodoListOptions["onSubmit"]) {
  return html`
    <form
      class="todo-input"
      data-key="todo-input-${listId}"
      @submit=${(event: SubmitEvent) => onSubmit(event, listId)}
    >
      <input
        type="text"
        name="description"
        class="todo-input-field"
        placeholder="Add a task"
        aria-label="New task"
        autocomplete="off"
      />
      <button
        type="submit"
        class="todo-input-submit"
        title="Add a task"
        aria-label="Add a task"
        tabindex="-1"
      >
        <app-icon name="plus" size="16"></app-icon>
      </button>
    </form>
  `;
}

export function TodoList(
  el: HTMLElement,
  list: { id: string; items: Todo[] },
  options: TodoListOptions,
) {
  render(
    html`
      <ul class="todo-items">
        ${repeat(
          list.items,
          (todo) => todo.id,
          (todo) => TodoItem(todo, options.onCompleted),
        )}
      </ul>
      ${TodoInput(list.id, options.onSubmit)}
    `,
    el,
  );
}
```

Notice how `TodoList` composes smaller template helpers (`TodoItem` and `TodoInput`)
into a single template and renders it directly into `el`. It uses Lit's `repeat` directive
with a key function (`(todo) => todo.id`) so Lit can efficiently add, remove, and reorder
list items in the DOM without recreating existing nodes.

### Real-world example with cleanup: `SyncStatusIndicator`

When a mounted Lit function subscribes to events or observers, it returns a `Dispose`
function. `SyncStatusIndicator` (`app/src/lib/shell/SyncStatusIndicator.ts`) listens to
data events and tears down both the listener and the DOM when unmounted:

```ts
import { html, nothing, render } from "lit";
import { dispatchAction, onData, type SyncStatusData } from "@/events.ts";
import type { Dispose } from "@/types.ts";
import "./sync-status-indicator.css";

// … helper functions …

export function SyncStatusIndicator(el: HTMLElement): Dispose {
  let disposed = false;

  const renderComponent = (status: SyncStatusData | null) => {
    if (disposed) return;
    const statusClass = status
      ? status.error || !status.connected
        ? "-is-error"
        : "-is-connected"
      : "";

    render(
      html`
        <div class="sync-status ${statusClass}" role="status" aria-label="Sync status">
          ${
            status
              ? html`
                  <span class="status-indicator" aria-hidden="true"></span>
                  ${getSyncLabel(status)}
                `
              : nothing
          }
        </div>
      `,
      el,
    );
  };

  const disposeListener = onData(el, "syncStatus", renderComponent);
  renderComponent(null);
  dispatchAction(el, "loadSyncStatus");

  return () => {
    if (disposed) return;
    disposed = true;
    disposeListener();
    render(nothing, el);
  };
}
```

When cleaning up a Lit render, pass `nothing` to Lit's `render(nothing, el)`. Lit will
cleanly remove all rendered DOM nodes and release internal template references.

### Responsibilities

- **The caller owns:**
  - Creating and providing the host element.
  - Deciding when to mount and when to call the returned `Dispose` callback.
  - Supplying fresh data and event handlers.
- **The function owns:**
  - Building the HTML template.
  - Binding event handlers and passing callback parameters.
  - Cleaning up any listeners or timers it created.

### When to use this pattern

Use a mounted Lit template function for:

- Route pages (`LoginPage`, `NotFoundPage`, `DocsPage`).
- Declarative sub-views driven by incoming props (`TodoList`, `PageHeader`).
- Fragments where Lit's declarative expressions (`@click`, `?hidden`, `repeat()`)
  make the UI easy to read and maintain.

---

## 2. Imperative functional components (The Controller Pattern)

In a purely declarative framework, every state update describes the entire new UI tree.
Most of the time that works well, but it falls apart when you need fine-grained control
over **user focus, active text selection, blur transitions, and keyboard events during
live background data updates**.

Imagine a user editing a list title. They click the title, which turns into an `<input>`,
and start typing. Suddenly, a background sync arrives from the server. If a parent template
re-renders the card, the `<input>` element would be replaced, the user's cursor position
would vanish, the mobile keyboard would flicker closed, and uncommitted edits would be
lost.

An **imperative functional component** solves this problem by separating the rigid card
structure from its dynamic content. It constructs its base DOM **once**, attaches persistent
event listeners to specific elements, and returns a controller object:

```ts
export type Controller<Data> = {
  element: HTMLElement;
  update: (data: Data) => void;
  destroy: Dispose;
};
```

### Real-world example: `TodoListCard`

`TodoListCard` (`app/src/pages/my-todos/TodoListCard.ts`) manages inline renaming, delete
confirmations, keyboard shortcuts, and focus preservation:

```ts
import { html, nothing, render } from "lit";
import type { Dispose } from "@/types.ts";
import "./todo-list-card.css";
import "@/ui/AppIcon.ts";
import { TodoList, type TodoListOptions } from "./TodoList.ts";
import type { TodoListData } from "./TodoStore.ts";

export type TodoListCardOptions = TodoListOptions & {
  onRename: (listId: string, name: string) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
};

export type TodoListCardController = {
  element: HTMLElement;
  update: (list: TodoListData) => void;
  destroy: Dispose;
};

export function TodoListCard(
  el: HTMLElement,
  initialList: TodoListData,
  options: TodoListCardOptions,
): TodoListCardController {
  let list = initialList;
  let editing = false;
  let skipBlurSave = false;
  let disposed = false;

  el.className = "todo-list-card";
  el.dataset.component = "todo-list-card";
  el.dataset.key = list.id;

  // 1. Render the static skeleton once into the host element
  render(
    html`
      <header class="card-header">
        <h2 class="card-title">
          <button type="button" class="card-title-button" title="Edit list name"></button>
        </h2>
        <input name="edit-title" type="text" class="card-title-input" aria-label="List name" />
        <button
          type="button"
          class="card-delete-button"
          title="Poista lista"
          aria-label="Poista lista"
        >
          <app-icon name="trash" size="16"></app-icon>
        </button>
      </header>
      <div class="todo-list"></div>
    `,
    el,
  );

  // 2. Query and hold direct references to key elements
  const titleButton = el.querySelector<HTMLButtonElement>(".card-title-button");
  const titleInput = el.querySelector<HTMLInputElement>(".card-title-input");
  const deleteButton = el.querySelector<HTMLButtonElement>(".card-delete-button");
  const todoList = el.querySelector<HTMLElement>(".todo-list");

  if (!titleButton || !titleInput || !deleteButton || !todoList) {
    throw new Error("Unable to mount todo list card: required element is missing");
  }

  const mountedTitleButton = titleButton;
  const mountedTitleInput = titleInput;
  const mountedDeleteButton = deleteButton;
  const mountedTodoList = todoList;
  const currentName = () => list.name ?? "";
  const focusTitleButton = () => mountedTitleButton.focus();

  // 3. Delicate interaction handling: focus, blur, and keyboard shortcuts
  const startEditing = () => {
    editing = true;
    el.classList.add("-is-editing");
    mountedTitleInput.value = currentName();
    mountedTitleInput.focus();
    mountedTitleInput.select();
  };

  const cancelEditing = () => {
    editing = false;
    mountedTitleInput.value = currentName();
    el.classList.remove("-is-editing");
    focusTitleButton();
  };

  const saveTitleInput = async (restoreFocus = false) => {
    if (!editing || skipBlurSave) {
      skipBlurSave = false;
      return;
    }

    editing = false;
    el.classList.remove("-is-editing");

    const name = mountedTitleInput.value.trim();
    if (name === currentName()) {
      if (restoreFocus) focusTitleButton();
      return;
    }

    if (restoreFocus) focusTitleButton();

    try {
      await options.onRename(list.id, name);
    } catch (error) {
      if (disposed) return;
      mountedTitleInput.value = currentName();
      console.error("Failed to update list name", error);
    }
  };

  // Keyboard navigation: Escape cancels, Enter commits
  const onTitleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void saveTitleInput(true);
    }
  };

  // Prevent saving when the user is explicitly clicking the Delete button
  const preserveEditOnDeletePointerDown = () => {
    skipBlurSave = true;
  };

  mountedTitleButton.addEventListener("click", startEditing);
  mountedTitleInput.addEventListener("blur", () => void saveTitleInput());
  mountedTitleInput.addEventListener("keydown", onTitleKeydown);
  mountedDeleteButton.addEventListener("mousedown", preserveEditOnDeletePointerDown);
  mountedDeleteButton.addEventListener("touchstart", preserveEditOnDeletePointerDown);
  mountedDeleteButton.addEventListener("click", onDelete);

  // 4. Targeted updates without rebuilding DOM
  function update(nextList: TodoListData) {
    if (disposed) return;
    list = nextList;
    mountedTitleButton.textContent = list.name || "...";
    if (!editing) mountedTitleInput.value = currentName();

    // Delegate inner items rendering to a mounted Lit template function!
    TodoList(mountedTodoList, list, {
      onSubmit: options.onSubmit,
      onCompleted: options.onCompleted,
    });
  }

  update(list);

  // 5. Explicit cleanup contract
  return {
    element: el,
    update,
    destroy: () => {
      if (disposed) return;
      disposed = true;
      mountedTitleButton.removeEventListener("click", startEditing);
      mountedTitleInput.removeEventListener("keydown", onTitleKeydown);
      mountedDeleteButton.removeEventListener("mousedown", preserveEditOnDeletePointerDown);
      mountedDeleteButton.removeEventListener("touchstart", preserveEditOnDeletePointerDown);
      mountedDeleteButton.removeEventListener("click", onDelete);
      render(nothing, mountedTodoList);
      render(nothing, el);
    },
  };
}
```

Notice the synergy here:

- The card shell is imperative, protecting active typing and focus states.
- The inner items container (`mountedTodoList`) delegates to `TodoList` (Pattern 1), getting the best of both worlds!

### Managing controllers from the parent: `MyTodosPage`

How does the parent reconcile these controllers when data changes? In `app/src/pages/my-todos/index.ts`,
`MyTodosPage` maintains a `Map<string, TodoListCardController>` keyed by list ID:

```ts
const cardControllers = new Map<string, TodoListCardController>();

const renderLists = (rows: ListWithTodoRow[]) => {
  const lists = mapTodoLists(rows);
  listIds = lists.map((list) => list.id);

  // 1. Destroy and remove cards that no longer exist in the database
  const activeListIds = new Set(listIds);
  for (const [listId, controller] of cardControllers) {
    if (!activeListIds.has(listId)) {
      controller.destroy();
      controller.element.remove();
      cardControllers.delete(listId);
    }
  }

  // 2. Add new cards or update existing ones
  lists.forEach((list, index) => {
    let controller = cardControllers.get(list.id);

    if (!controller) {
      const card = document.createElement("article");
      controller = TodoListCard(card, list, {
        onSubmit,
        onCompleted,
        onRename,
        onDelete,
      });
      cardControllers.set(list.id, controller);
    } else {
      // Existing card: only update data, preserving internal editing/focus state!
      controller.update(list);
    }

    // 3. Keep DOM order synchronized with database order without re-creating nodes
    const cardAtIndex = container?.children[index];
    if (cardAtIndex !== controller.element) {
      container?.insertBefore(controller.element, cardAtIndex ?? null);
    }
  });

  updatePositions();
  updateHeight();
};
```

Because `container.insertBefore()` moves existing DOM nodes rather than cloning them,
cards are reordered without losing their internal state, and browsers don't needlessly
re-render untouched subtrees.

### Responsibilities

- **The controller owns:**
  - Creating its base DOM elements once.
  - Adding and removing all event listeners.
  - Managing private interaction states (`editing`, `skipBlurSave`).
  - Handling focus restoration and keyboard traps.
  - Mutating text and attributes in `update()`.
  - Releasing resources and clearing DOM in `destroy()`.
- **The parent owns:**
  - Instantiating controllers and mapping them to data entities.
  - Calling `controller.update(newData)` when data changes.
  - Positioning the controller's `.element` in the DOM layout.
  - Calling `controller.destroy()` and removing the element when deleted.

### When to use this pattern

Use an imperative functional component when:

- A component features inline text editing, custom input controls, or complex focus transitions.
- Background sync or data updates could arrive while the user is actively interacting with the element.
- The component requires delicate pointer or keyboard coordination (e.g., drag-and-drop, modals,
  complex dropdowns).

---

## 3. Reactive `LitElement` components (Web Components)

A reactive `LitElement` component is a standard autonomous Web Component that extends
Lit's `LitElement` base class and is registered with `customElements.define()`.

Unlike the previous two patterns, a `LitElement` is a first-class HTML element. It can be
written directly into any HTML document, passed custom attributes, and rendered inside any
Lit template just like a built-in `<button>` or `<input>`.

### Real-world example: `<app-icon>`

`<app-icon>` (`app/src/lib/ui/AppIcon.ts`) renders vector icons throughout the app:

```ts
import "./app-icon.css";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { createElement } from "lucide";
import { config } from "@/config.ts";
import { appIcons, isAppIconName, resolveIcon, type AppIconName } from "./icons.ts";

class AppIcon extends LitElement {
  static override properties = {
    name: { type: String },
    size: { type: Number },
    strokeWidth: { type: Number, attribute: "stroke-width" },
  };

  public name: AppIconName | undefined;
  public size: number | undefined;
  public strokeWidth: number;

  constructor() {
    super();
    this.name = undefined;
    this.size = undefined;
    this.strokeWidth = 1.75;
  }

  // Render directly into light DOM so global CSS tokens and Tailwind styles apply
  protected override createRenderRoot() {
    return this;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("size")) {
      const size = this.size === undefined ? "" : `${this.size}px`;
      this.style.width = size;
      this.style.height = size;
    }
  }

  override render() {
    if (!this.name) return nothing;
    if (!isAppIconName(this.name)) {
      if (config.isDevelopment) console.warn(`<app-icon>: unknown icon name "${this.name}"`);
      return nothing;
    }

    const { node, attrs } = resolveIcon(appIcons[this.name]);
    return html`${createElement(node, {
      ...attrs,
      "stroke-width": this.strokeWidth,
      "aria-hidden": "true",
      focusable: "false",
    })}`;
  }
}

customElements.define("app-icon", AppIcon);
```

### Usage anywhere in templates and HTML

Because `<app-icon>` is registered as a custom element, any template or component can
use it declaratively:

```html
<app-icon name="trash" size="16"></app-icon>
<app-icon name="plus" size="18" stroke-width="2"></app-icon>
```

When attributes change in HTML or properties change in JavaScript, `LitElement`'s reactive
lifecycle automatically schedules an asynchronous re-render.

### Why `createRenderRoot() { return this; }`?

By default, `LitElement` attaches a Shadow Root to isolate markup and CSS. While useful for
third-party widget libraries, Shadow DOM in an internal application introduces friction:
it blocks global CSS styles, complicates Tailwind 4 utility styling, and alters event
propagation boundaries.

In this app, custom elements override `createRenderRoot()` to render into the **Light DOM**
(`return this`). This gives you the benefits of custom elements (tag reusability and reactive
properties) while preserving seamless integration with project-wide CSS variables and design tokens.

### Responsibilities

- **The custom element owns:**
  - Reactive property definitions (`static properties`).
  - Parsing attributes from HTML (`type: Number`, `attribute: "stroke-width"`).
  - Lifecycle hooks (`connectedCallback`, `disconnectedCallback`, `willUpdate`).
  - Scheduling renders when properties change.
- **The consumer owns:**
  - Placing `<app-icon>` into the markup or template.
  - Setting attributes or binding dynamic properties.

### When to use this pattern

Use a reactive `LitElement` when:

- Creating small, reusable atomic UI primitives used across multiple pages and templates.
- You want an ergonomic HTML tag (`<app-icon>`).
- The component's state is strictly driven by public properties or attributes.

---

## Pattern comparison

| Concern                      | 1. Mounted Lit function               | 2. Imperative component (Controller)     | 3. Reactive `LitElement`                     |
| :--------------------------- | :------------------------------------ | :--------------------------------------- | :------------------------------------------- |
| **Example in app**           | `TodoList`, `SyncStatusIndicator`     | `TodoListCard`                           | `AppIcon`                                    |
| **Host element**             | Provided by caller                    | Provided by caller                       | Created by browser (`<tag-name>`)            |
| **DOM ownership**            | Lit declarative `render()`            | Manual DOM creation & cached nodes       | Lit declarative `render()`                   |
| **State**                    | Parent props or closure variables     | Component closure variables              | Reactive `static properties`                 |
| **Reactivity**               | Caller re-invokes or calls `render()` | Caller calls `update(nextData)`          | Automatic on property/attribute change       |
| **Lifecycle contract**       | Returns `Dispose` function            | Returns `{ update, destroy }`            | `connectedCallback` / `disconnectedCallback` |
| **Focus & edit safety**      | Replaced if parent re-renders         | Fully preserved across updates           | Re-renders template inside host              |
| **Custom element required?** | No                                    | No                                       | Yes (`customElements.define`)                |
| **Best used for**            | Pages, layouts, declarative fragments | Interaction-heavy widgets with live sync | Reusable leaf UI primitives                  |

---

## The golden rule of DOM ownership

The three patterns work smoothly together in this codebase because each DOM node has
**exactly one rendering owner**.

> **Golden Rule**: Never let a parent Lit `render()` call replace a DOM subtree that an
> imperative controller is actively managing.

Consider how `MyTodos` and `TodoListCard` compose:

```text
MyTodos (Mounted Lit template function)
  │
  ├─ Toolbar & paging buttons (Rendered by Lit)
  │
  └─ Container: <div class="todo-list-container"></div> (Rendered once by Lit)
       │
       │ Managed imperatively by MyTodos via insertBefore() and Map<string, Controller>
       │
       ├─ TodoListCard A (Imperative Controller: owns <article> and card header)
       │    └─ Slot: <div class="todo-list"></div>
       │         └─ TodoList (Mounted Lit template function: renders <ul> and <form>)
       │              └─ <app-icon> (Reactive LitElement custom element)
       │
       └─ TodoListCard B (Imperative Controller)
            └─ …
```

Look at the boundaries:

1. `MyTodos` renders the outer shell once with Lit, creating the empty container `.todo-list-container`.
2. Inside that container, `MyTodos` manages child cards **imperatively** using `TodoListCardController`.
   Lit's template compiler never touches the `.todo-list-container` children again.
3. Each `TodoListCard` owns its header, title inputs, and delete button directly.
4. For the todo items themselves, the card delegates to `TodoList` by rendering into a dedicated child
   slot (`.todo-list`).
5. Inside `TodoList`, icons are rendered using the `<app-icon>` custom element.

Because every boundary is clean, a background PowerSync sync can update list items, reorder
lists, or change sync status without resetting an active cursor in an inline title input.

---

## Quick guide: Which pattern should I choose?

When adding a new feature or component, ask yourself these three questions:

```text
Is it an atomic UI element reused across many templates by tag name (like an icon, button, badge)?
 │
 ├── YES ──▶ Use Pattern 3: Reactive LitElement (<my-badge>)
 │
 └── NO
      │
      Does it have complex interaction, inline editing, or sensitive focus state that must survive live data updates?
       │
       ├── YES ──▶ Use Pattern 2: Imperative Functional Component (Controller with update/destroy)
       │
       └── NO  ──▶ Use Pattern 1: Mounted Lit Template Function (Pure template or Mount/Dispose)
```

### Checklist for new components

- [ ] **Did you import CSS beside the component?** E.g. `import "./my-component.css"`.
- [ ] **Does your mount return a disposer?** Return `() => void` if you register event listeners,
      observers, or subscriptions.
- [ ] **Did you guard async operations?** If your component fetches data or awaits promises, check
      `if (disposed) return;` before updating DOM.
- [ ] **Is DOM ownership clear?** Make sure no parent declarative template will inadvertently
      clobber elements managed by a child controller.
