import type { AppIconName } from "@/ui/icons.ts";

export type NavItem = {
  title: string;
  icon?: AppIconName;
  url?: string;
  items?: { title: string; url: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "My Todos",
    icon: "listTodo",
    url: "/my-todos",
  },
  {
    title: "Documentation",
    icon: "bookOpenText",
    items: [
      { title: "Introduction", url: "/docs/introduction" },
      { title: "Rendering Patterns", url: "/docs/rendering-patterns" },
      { title: "Styling & CSS", url: "/docs/styling" },
    ],
  },
  {
    title: "Settings",
    icon: "cog",
    url: "/settings",
  },
];
