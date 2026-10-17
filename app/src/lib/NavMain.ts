import { html } from "lit";
import "@/lib/AppIcon.ts";
import "@/components/AppCollapsible.ts";
import "@/components/AppCollapsibleContent.ts";
import "@/components/AppCollapsibleTrigger.ts";
import "@/components/SidebarGroup.ts";
import "@/components/SidebarGroupLabel.ts";
import "@/components/SidebarMenu.ts";
import "@/components/SidebarMenuAction.ts";
import "@/components/SidebarMenuButton.ts";
import "@/components/SidebarMenuItem.ts";
import "@/components/SidebarMenuSub.ts";
import "@/components/SidebarMenuSubButton.ts";
import "@/components/SidebarMenuSubItem.ts";

type NavItem = {
  title: string;
  url?: string;
  icon: string;
  items?: {
    title: string;
    url: string;
  }[];
};

const items: NavItem[] = [
  {
    title: "MyTodos",
    icon: "command",
  },
  {
    title: "Documentation",
    icon: "bookOpenText",
    items: [
      {
        title: "Introduction",
        url: "#",
      },
      {
        title: "Get Started",
        url: "#",
      },
      {
        title: "Tutorials",
        url: "#",
      },
      {
        title: "Changelog",
        url: "#",
      },
    ],
  },
  {
    title: "Settings",
    icon: "cog",
    items: [
      {
        title: "General",
        url: "#",
      },
      {
        title: "Team",
        url: "#",
      },
      {
        title: "Billing",
        url: "#",
      },
      {
        title: "Limits",
        url: "#",
      },
    ],
  },
];

export function NavMain() {
  return html`
    <sidebar-group>
      <sidebar-group-label>Application</sidebar-group-label>
      <sidebar-menu>
        ${items.map(
          (item) => html`
            <app-collapsible default-open="true">
              <sidebar-menu-item>
                <sidebar-menu-button tooltip="${item.title}">
                  <a href="${item.url}">
                    <app-icon name="${item.icon}"></app-icon>
                    <span>${item.title}</span>
                  </a>
                </sidebar-menu-button>
                ${
                  item.items?.length &&
                  html`
                      <app-collapsible-trigger>
                        <sidebar-menu-action>
                          <app-icon name="right"></app-icon>
                          <span class="sr-only">Toggle</span>
                        </sidebar-menu-action>
                      </app-collapsible-trigger>
                      <app-collapsible-content>
                        <sidebar-menu-sub>
                          ${item.items.map(
                            (subItem) => html`
                              <sidebar-menu-sub-item>
                                <sidebar-menu-sub-button>
                                  <a href="${subItem.url}">
                                    <span>${subItem.title}</span>
                                  </a>
                                </sidebar-menu-sub-button>
                              </sidebar-menu-sub-item>
                            `,
                          )}
                        </sidebar-menu-sub>
                      </app-collapsible-content>
                    `
                }
              </sidebar-menu-item>
            </app-collapsible>
          `,
        )}
      </sidebar-menu>
    </sidebar-group>
  `;
}
