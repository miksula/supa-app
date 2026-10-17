import { css, html, LitElement } from "lit";

const baseStyles = css`
  :host {
    box-sizing: border-box;
    color: inherit;
    display: block;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;

const listStyles = css`
  ${baseStyles}

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
`;

class SidebarSlotElement extends LitElement {
  static styles = baseStyles;

  protected renderSlot() {
    return html`<slot></slot>`;
  }

  render() {
    return this.renderSlot();
  }
}

export class AppCollapsible extends SidebarSlotElement {
  private open = this.hasAttribute("default-open");

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("sidebar-toggle", this.toggle);
  }

  disconnectedCallback() {
    this.removeEventListener("sidebar-toggle", this.toggle);
    super.disconnectedCallback();
  }

  private toggle = () => {
    this.open = !this.open;
    this.toggleAttribute("data-state", this.open);
    this.querySelector("app-collapsible-content")?.toggleAttribute("hidden", !this.open);
  };

  render() {
    return html`<div data-state="${this.open ? "open" : "closed"}"><slot></slot></div>`;
  }
}

export class AppCollapsibleContent extends SidebarSlotElement {
  static styles = [
    baseStyles,
    css`
      :host([hidden]) {
        display: none;
      }
    `,
  ];
}

export class AppCollapsibleTrigger extends SidebarSlotElement {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this.requestToggle);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.requestToggle);
    super.disconnectedCallback();
  }

  private requestToggle = () => {
    this.dispatchEvent(new CustomEvent("sidebar-toggle", { bubbles: true, composed: true }));
  };
}

export class SidebarGroup extends SidebarSlotElement {}

export class SidebarGroupLabel extends SidebarSlotElement {
  static styles = [
    baseStyles,
    css`
      :host {
        color: var(--muted-foreground);
        font-size: var(--text-xs, 0.75rem);
        font-weight: 500;
      }
    `,
  ];
}

export class SidebarMenu extends SidebarSlotElement {
  static styles = listStyles;

  render() {
    return html`<ul><slot></slot></ul>`;
  }
}

export class SidebarMenuAction extends SidebarSlotElement {
  static styles = [
    baseStyles,
    css`
      button {
        align-items: center;
        background: transparent;
        border: 0;
        color: inherit;
        cursor: pointer;
        display: inline-flex;
        justify-content: center;
        padding: 0.25rem;
      }
    `,
  ];

  render() {
    return html`<button type="button"><slot></slot></button>`;
  }
}

export class SidebarMenuButton extends SidebarSlotElement {
  static styles = [
    baseStyles,
    css`
      ::slotted(a) {
        align-items: center;
        color: inherit;
        display: flex;
        gap: 0.5rem;
        text-decoration: none;
      }
    `,
  ];
}

export class SidebarMenuItem extends SidebarSlotElement {
  static styles = listStyles;

  render() {
    return html`<li><slot></slot></li>`;
  }
}

export class SidebarMenuSub extends SidebarSlotElement {
  static styles = listStyles;

  render() {
    return html`<ul><slot></slot></ul>`;
  }
}

export class SidebarMenuSubButton extends SidebarSlotElement {
  static styles = [
    baseStyles,
    css`
      ::slotted(a) {
        color: inherit;
        display: block;
        text-decoration: none;
      }
    `,
  ];
}

export class SidebarMenuSubItem extends SidebarSlotElement {
  static styles = listStyles;

  render() {
    return html`<li><slot></slot></li>`;
  }
}

customElements.define("app-collapsible", AppCollapsible);
customElements.define("app-collapsible-content", AppCollapsibleContent);
customElements.define("app-collapsible-trigger", AppCollapsibleTrigger);
customElements.define("sidebar-group", SidebarGroup);
customElements.define("sidebar-group-label", SidebarGroupLabel);
customElements.define("sidebar-menu", SidebarMenu);
customElements.define("sidebar-menu-action", SidebarMenuAction);
customElements.define("sidebar-menu-button", SidebarMenuButton);
customElements.define("sidebar-menu-item", SidebarMenuItem);
customElements.define("sidebar-menu-sub", SidebarMenuSub);
customElements.define("sidebar-menu-sub-button", SidebarMenuSubButton);
customElements.define("sidebar-menu-sub-item", SidebarMenuSubItem);
