import type { AppIconName } from "@/ui/icons.ts";

export type NavItem = {
  title: string;
  icon?: AppIconName;
  url?: string;
  items?: { title: string; url: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Omat tehtävät",
    icon: "listTodo",
    url: "/my-todos",
  },
  {
    title: "Dokumentaatio",
    icon: "bookOpenText",
    items: [
      { title: "Esittely", url: "/docs/introduction" },
      { title: "Renderöintimallit", url: "/docs/rendering-patterns" },
      { title: "Tyylit ja CSS", url: "/docs/styling" },
    ],
  },
  {
    title: "Asetukset",
    icon: "cog",
    url: "/settings",
  },
];
