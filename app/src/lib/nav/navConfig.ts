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
    url: "/",
  },
  {
    title: "Dokumentaatio",
    icon: "bookOpenText",
    items: [
      { title: "Esittely", url: "/docs/introduction" },
      { title: "Aloittaminen", url: "/docs/get-started" },
      { title: "Renderöintimallit", url: "/docs/rendering-patterns" },
      { title: "Oppaat", url: "/docs/tutorials" },
      { title: "Muutosloki", url: "/docs/changelog" },
    ],
  },
  {
    title: "Asetukset",
    icon: "cog",
    url: "/settings",
  },
];
