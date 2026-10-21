export type Dispose = () => void;
export type Mount<Props = void> = (el: HTMLElement, props: Props) => Dispose | void;

export type AppRouter = import("@packages/router").RouterType;
export type RouteSource = Pick<AppRouter, "path" | "addRouteListener" | "removeRouteListener">;

export interface LayoutInstance {
  /** Outlet element where the current page should be mounted */
  contentSlot: HTMLElement;

  /** Optional cleanup when transitioning away from this layout */
  dispose?: Dispose;
}

export type LayoutFactory = (container: HTMLElement) => LayoutInstance;
