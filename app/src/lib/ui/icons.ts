/**
 * Icon registry for `<app-icon name="…">`.
 *
 * Adding a Lucide icon:
 *   1. Find the icon at https://lucide.dev/icons (e.g. "arrow-right").
 *   2. Import its PascalCase export from "lucide" (e.g. `ArrowRight`). Named imports are
 *      tree-shaken, so only the icons registered here end up in the bundle.
 *   3. Add an entry to `appIcons` below. The key is the name used in templates:
 *      `<app-icon name="arrowRight" size="16"></app-icon>`.
 *
 * Adding a non-Lucide icon (brand logo, another icon set, custom artwork):
 *   Describe the SVG's children as an `IconNode` (a list of `[tag, attributes]` pairs) and
 *   register it like any Lucide icon. Lucide's root defaults are applied to the `<svg>`:
 *   viewBox="0 0 24 24", fill="none", stroke="currentColor", stroke-linecap/linejoin="round".
 *
 *   - 24×24 outline icons (e.g. Tabler, Feather) usually work as a bare `IconNode`:
 *
 *       const tablerLogout: IconNode = [
 *         ["path", { d: "M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" }],
 *         ["path", { d: "M9 12h12l-3 -3" }],
 *         ["path", { d: "M18 15l3 -3" }],
 *       ];
 *
 *   - Icons that need different root `<svg>` attributes (another viewBox, filled shapes)
 *     use the `{ node, attrs }` form. `attrs` are applied to the `<svg>` element:
 *
 *       const octiconCheck: CustomIcon = {
 *         attrs: { viewBox: "0 0 16 16", fill: "currentColor", stroke: "none" },
 *         node: [["path", { d: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a…" }]],
 *       };
 *
 *   Copy only the drawing elements (`path`, `circle`, `rect`, …) from the original SVG.
 *   Leave out `width`/`height`/`class`/`style`; `<app-icon>` sets sizing, color and
 *   accessibility attributes. Hard-coded colors (e.g. `fill="#000"`) break theming, so
 *   use `currentColor`.
 *
 *   An `IconNode` can't nest elements, so flatten `<g>` groups by moving their attributes
 *   onto the children. Turn an inline `style="fill: …"` into a `fill` attribute.
 *   `stroke-width` is controlled by `<app-icon>`; to change it for one usage, set the
 *   `stroke-width` attribute on the element.
 */
import {
  BookOpenText,
  Check,
  ChessRook,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleCheckBig,
  Command,
  Hexagon,
  ListPlus,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  SquarePen,
  SunMoon,
  Trash,
  type IconNode,
  type SVGProps,
} from "lucide";

/** A non-Lucide icon that needs its own root `<svg>` attributes (viewBox, fill, …). */
export type CustomIcon = {
  node: IconNode;
  attrs?: SVGProps;
};

export type IconDefinition = IconNode | CustomIcon;

export const appIcons = {
  addList: ListPlus,
  bookOpenText: BookOpenText,
  circle: Circle,
  circleCheck: CircleCheckBig,
  check: Check,
  chessRook: ChessRook,
  cog: Settings,
  colorScheme: SunMoon,
  command: Command,
  listTodo: ListTodo,
  logo: Hexagon,
  logout: LogOut,
  next: ChevronRight,
  plus: Plus,
  previous: ChevronLeft,
  squarePen: SquarePen,
  trash: Trash,
  upDown: ChevronsUpDown,
} satisfies Record<string, IconDefinition>;

export type AppIconName = keyof typeof appIcons;

export function isAppIconName(name: string): name is AppIconName {
  return Object.hasOwn(appIcons, name);
}

export function resolveIcon(icon: IconDefinition): CustomIcon {
  return Array.isArray(icon) ? { node: icon } : icon;
}
