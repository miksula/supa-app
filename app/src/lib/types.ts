export type MountFunction = (el: HTMLElement) => void | (() => void);

export type AppRouter = typeof import("@packages/router").router;
export type RouteSource = Pick<AppRouter, "path" | "addRouteListener" | "removeRouteListener">;

export interface LayoutInstance {
  /** Root DOM element of the layout */
  element: HTMLElement;

  /** Outlet element where the current page should be mounted */
  contentSlot: HTMLElement;

  /** Optional cleanup when transitioning away from this layout */
  dispose?: () => void;
}

export type LayoutFactory = (container: HTMLElement) => LayoutInstance;
