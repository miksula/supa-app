# Rendering patterns

This project uses three component patterns for browser UI:

1. Mounted Lit template functions
2. Imperative functional components
3. Reactive `LitElement` components

All three patterns can render HTML and respond to events. The important
difference is where state, DOM ownership, and lifecycle responsibilities live.
Choose one primary owner for each component. Avoid having a parent Lit render
recreate DOM that a child imperative component is also managing.

The examples below implement the same counter in each style.

## Shared example: `MyCounter`

The counter has:

- A numeric `value`.
- An Increment button.
- A Decrement button.
- A `counter` custom event carrying the next value.
- The ability to be reset by dispatching a `counter` event from outside.

The event is useful for demonstrating the boundary between a component and its
parent. The component emits an event, and the event handler updates the
component's state before rendering the new value.

## 1. Mounted Lit template function

A mounted Lit template function receives an existing element and renders a Lit
template into it:

```ts
import { html, render } from "lit";

export function MyCounter(el: HTMLElement) {
  let value = 0;

  function emitCounter(nextValue: number) {
    el.dispatchEvent(
      new CustomEvent<number>("counter", {
        detail: nextValue,
        bubbles: true,
      }),
    );
  }

  function onCounter(event: Event) {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "number") {
      return;
    }

    value = event.detail;
    update();
  }

  function update() {
    render(
      html`
        <span class="value">${value}</span>

        <button
          type="button"
          class="increment"
          @click=${() => emitCounter(value + 1)}
        >
          Increment
        </button>

        <button
          type="button"
          class="decrement"
          @click=${() => emitCounter(value - 1)}
        >
          Decrement
        </button>
      `,
      el,
    );
  }

  el.addEventListener("counter", onCounter);
  update();

  return () => {
    el.removeEventListener("counter", onCounter);
    render(undefined, el);
  };
}
```

Mounting:

```ts
document
  .querySelectorAll<HTMLElement>(".my-counter")
  .forEach((el) => MyCounter(el));
```

Markup:

```html
<div class="my-counter"></div>
```

Resetting an instance:

```ts
const counter = document.querySelector<HTMLElement>(".my-counter");

counter?.dispatchEvent(
  new CustomEvent<number>("counter", {
    detail: 0,
    bubbles: true,
  }),
);
```

### Responsibilities

The caller owns:

- The host element.
- The decision to mount the component.
- The decision to destroy the component.
- The component's position in the page.

The function owns:

- The counter state held in its closure.
- The Lit template.
- The event listener registered on the host element.
- The cleanup function returned to the caller.

### Strengths

- Does not require a custom element.
- Works naturally with an existing page or layout DOM.
- Makes mounting and cleanup explicit.
- Keeps a small component lightweight.
- Allows the parent to decide when and where to render.

### Limitations

- State is not visible to Lit as a reactive property.
- The function must call `update()` after every state change.
- The caller must retain and call the returned cleanup function.
- Re-rendering the host from outside can replace the component's DOM.
- The component is not independently usable as an HTML element.

This pattern is useful for page-level functions and data-driven fragments
whose lifecycle is controlled by a parent. In this repository,
`TodoList` follows this pattern: it receives an element and renders the inner
todo-list template into it.

## 2. Imperative functional component

An imperative functional component creates its rigid base DOM once and then
manages interaction with DOM APIs:

```ts
export type CounterController = {
  update: (value: number) => void;
  destroy: () => void;
};

export function MyCounter(
  el: HTMLElement,
  initialValue = 0,
): CounterController {
  let value = initialValue;

  el.innerHTML = `
    <span class="value"></span>
    <button type="button" class="increment">Increment</button>
    <button type="button" class="decrement">Decrement</button>
  `;

  const valueElement = el.querySelector<HTMLElement>(".value");
  const incrementButton = el.querySelector<HTMLButtonElement>(".increment");
  const decrementButton = el.querySelector<HTMLButtonElement>(".decrement");

  if (!valueElement || !incrementButton || !decrementButton) {
    throw new Error("Unable to mount counter: required element is missing");
  }

  function emitCounter(nextValue: number) {
    el.dispatchEvent(
      new CustomEvent<number>("counter", {
        detail: nextValue,
        bubbles: true,
      }),
    );
  }

  function onCounter(event: Event) {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "number") {
      return;
    }

    value = event.detail;
    update();
  }

  function update() {
    valueElement.textContent = String(value);
  }

  const onIncrement = () => emitCounter(value + 1);
  const onDecrement = () => emitCounter(value - 1);

  incrementButton.addEventListener("click", onIncrement);
  decrementButton.addEventListener("click", onDecrement);
  el.addEventListener("counter", onCounter);
  update();

  return {
    update(nextValue) {
      value = nextValue;
      update();
    },
    destroy() {
      incrementButton.removeEventListener("click", onIncrement);
      decrementButton.removeEventListener("click", onDecrement);
      el.removeEventListener("counter", onCounter);
      el.replaceChildren();
    },
  };
}
```

Usage:

```ts
const counterElement = document.querySelector<HTMLElement>(".my-counter");

if (counterElement) {
  const counter = MyCounter(counterElement);

  counter.update(10);

  // When the containing view is removed:
  counter.destroy();
}
```

### Responsibilities

The component owns:

- Its base DOM structure.
- Event listener registration and removal.
- Local interaction state.
- Focus behavior.
- DOM updates.
- Its explicit `update()` and `destroy()` lifecycle.

The caller owns:

- Supplying the host element.
- Passing data and callbacks.
- Calling `update()` when external data changes.
- Calling `destroy()` when the component is removed.

### Strengths

- Precise control over focus, blur, pointer, and keyboard behavior.
- No custom element registration.
- No complete rerender is needed for small state changes.
- Explicit lifecycle is easy to integrate with an existing DOM application.
- Local state can remain private to the component.

### Limitations

- More manual DOM code.
- The component must clean up every listener it adds.
- The component must keep DOM and state synchronized.
- Updates are not automatically reactive.
- Direct `innerHTML` must not contain untrusted interpolated values.

This pattern is useful for interaction-heavy widgets. In this repository,
`TodoListCard` follows this pattern because list editing, Delete confirmation,
keyboard focus, and blur behavior benefit from direct DOM ownership.

## 3. Reactive `LitElement`

A reactive `LitElement` owns a custom element, its lifecycle, and its reactive
properties:

```ts
import { LitElement, html } from "lit";

export class MyCounter extends LitElement {
  static properties = {
    value: {
      type: Number,
    },
  };

  declare value: number;

  constructor() {
    super();
    this.value = 0;
    this.onCounter = this.onCounter.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("counter", this.onCounter);
  }

  disconnectedCallback() {
    this.removeEventListener("counter", this.onCounter);
    super.disconnectedCallback();
  }

  onCounter(event: Event) {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "number") {
      return;
    }

    this.value = event.detail;
  }

  emitCounter(nextValue: number) {
    this.dispatchEvent(
      new CustomEvent<number>("counter", {
        detail: nextValue,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <span class="value">${this.value}</span>

      <button
        type="button"
        class="increment"
        @click=${() => this.emitCounter(this.value + 1)}
      >
        Increment
      </button>

      <button
        type="button"
        class="decrement"
        @click=${() => this.emitCounter(this.value - 1)}
      >
        Decrement
      </button>
    `;
  }
}

customElements.define("my-counter", MyCounter);
```

Usage:

```html
<my-counter></my-counter>
```

Resetting an instance:

```ts
document.querySelector("my-counter")?.dispatchEvent(
  new CustomEvent("counter", {
    detail: 0,
    bubbles: true,
    composed: true,
  }),
);
```

### Responsibilities

The custom element owns:

- Reactive properties such as `value`.
- Rendering from property state.
- Connected and disconnected lifecycle hooks.
- Event listener setup and cleanup.
- The DOM inside its render root.

The parent owns:

- Inserting `<my-counter>` into the document.
- Passing public properties or attributes.
- Listening to events that bubble out of the component.

### Strengths

- Property changes automatically schedule a render.
- State and template remain declaratively connected.
- Lifecycle hooks provide a standard cleanup boundary.
- The component is reusable from HTML, JavaScript, or another Lit template.
- Shadow DOM can isolate markup and styles when appropriate.

### Limitations

- Requires custom-element registration.
- Introduces class-based lifecycle and browser custom-element semantics.
- Can be heavier than a small mount function.
- Shadow DOM changes styling and event propagation behavior.
- Focus behavior still needs deliberate event handling; reactivity does not
  remove browser focus rules.

This pattern is useful for reusable widgets with meaningful internal state.
It is not necessary merely to render a small template fragment.

## Comparison

| Concern | Mounted Lit function | Imperative function | Reactive `LitElement` |
| --- | --- | --- | --- |
| Host | Existing element supplied by caller | Existing element supplied by caller | Custom element instance |
| State | Closure or parent-owned | Component-local variables | Reactive properties/state |
| Rendering | Explicit `render()` call | Manual DOM mutation | Automatic after property changes |
| Lifecycle | Caller-managed | `update()`/`destroy()` contract | Custom-element callbacks |
| Focus control | Possible, but manual | Excellent | Possible, with lifecycle/state coordination |
| Custom element required | No | No | Yes |
| Best for | Data-driven fragments | Interaction-heavy widgets | Reusable stateful widgets |

## Choosing a pattern

Use a **mounted Lit template function** when the parent owns the lifecycle and
the component is primarily a data-driven view.

Use an **imperative functional component** when focus, keyboard interaction,
pointer behavior, or exact DOM lifecycle control is the main concern.

Use a **reactive `LitElement`** when the component should be independently
usable as a custom HTML element and has substantial internal reactive state.

The patterns can coexist in one application, but a single DOM subtree should
have one clear rendering owner. For example, an imperative `TodoListCard`
should not be recreated by a parent Lit render on every database update if it
is responsible for preserving its own editing and focus state.