import type { AppIconName } from "@/ui/icons.ts";

export type NavItem = {
  title: string;
  icon?: AppIconName;
  url?: string;
  items?: { title: string; url: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "My todos",
    icon: "listTodo",
    url: "/",
  },
  {
    title: "Documentation",
    icon: "bookOpenText",
    items: [
      { title: "Introduction", url: "/docs/introduction" },
      { title: "Get Started", url: "/docs/get-started" },
      { title: "Rendering Patterns", url: "/docs/rendering-patterns" },
      { title: "Tutorials", url: "/docs/tutorials" },
      { title: "Changelog", url: "/docs/changelog" },
    ],
  },
  {
    title: "Settings",
    icon: "cog",
    url: "/settings",
  },
];
