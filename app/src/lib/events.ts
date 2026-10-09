/**
 * Component events, vanilla-todo style:
 * - Actions (verbs) bubble UP from a component towards a controller.
 * - Data (nouns) flows DOWN: dispatched directly on the element that asked for
 *   it (pull-only), never bubbling.
 *
 * Each direction is a discriminated union on `type`; `detail` is the payload.
 */

export type SyncStatusData = {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  uploading: boolean;
  lastSyncedAt?: Date;
  hasSynced?: boolean;
  error?: Error;
};

export type ActionEvent = { type: "loadSyncStatus" };

export type DataEvent = { type: "syncStatus"; detail: SyncStatusData };

type Detail<E, T> = Extract<E, { type: T }> extends { detail: infer D } ? D
  : undefined;

type DetailArgs<E, T> = Detail<E, T> extends undefined ? []
  : [detail: Detail<E, T>];

type Handler<E, T> = (
  detail: Detail<E, T>,
  e: CustomEvent<Detail<E, T>>,
) => void;

function dispatch<E extends { type: string }, T extends E["type"]>(
  el: EventTarget,
  type: T,
  bubbles: boolean,
  detail: unknown,
) {
  el.dispatchEvent(
    new CustomEvent(type, { detail, bubbles, composed: bubbles }),
  );
}

function listen<E extends { type: string }, T extends E["type"]>(
  el: EventTarget,
  type: T,
  handler: Handler<E, T>,
) {
  const listener = (e: Event) =>
    handler((e as CustomEvent).detail, e as CustomEvent);
  el.addEventListener(type, listener);
  return () => el.removeEventListener(type, listener);
}

/** Dispatch an action that bubbles up to a controller. */
export function up<T extends ActionEvent["type"]>(
  el: EventTarget,
  type: T,
  ...[detail]: DetailArgs<ActionEvent, T>
) {
  dispatch<ActionEvent, T>(el, type, true, detail);
}

/** Dispatch data directly on a (child) element; does not bubble. */
export function down<T extends DataEvent["type"]>(
  el: EventTarget,
  type: T,
  ...[detail]: DetailArgs<DataEvent, T>
) {
  dispatch<DataEvent, T>(el, type, false, detail);
}

/** Listen for an action. Returns an unsubscribe function. */
export function onAction<T extends ActionEvent["type"]>(
  el: EventTarget,
  type: T,
  handler: Handler<ActionEvent, T>,
) {
  return listen<ActionEvent, T>(el, type, handler);
}

/** Listen for data. Returns an unsubscribe function. */
export function onData<T extends DataEvent["type"]>(
  el: EventTarget,
  type: T,
  handler: Handler<DataEvent, T>,
) {
  return listen<DataEvent, T>(el, type, handler);
}
