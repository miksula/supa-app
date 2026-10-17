import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import addListIcon from "@/assets/add-list-icon.svg?raw";
import checkIcon from "@/assets/check-icon.svg?raw";
import colorSchemeIcon from "@/assets/color-scheme-icon.svg?raw";
import logoIcon from "@/assets/logo.svg?raw";
import logoutIcon from "@/assets/logout-icon.svg?raw";
import nextIcon from "@/assets/next-icon.svg?raw";
import plusIcon from "@/assets/plus-icon.svg?raw";
import previousIcon from "@/assets/previous-icon.svg?raw";
import trashIcon from "@/assets/trash-icon.svg?raw";
import commandIcon from "@/assets/commad-icon.svg?raw";

const icons = {
  addList: addListIcon,
  check: checkIcon,
  colorScheme: colorSchemeIcon,
  logo: logoIcon,
  logout: logoutIcon,
  next: nextIcon,
  plus: plusIcon,
  previous: previousIcon,
  trash: trashIcon,
  command: commandIcon,
} as const;

type AppIconName = keyof typeof icons;

class AppIcon extends LitElement {
  static override properties = {
    name: { type: String },
    size: { type: Number },
  };

  public name: AppIconName | undefined;
  public size: number | undefined;

  constructor() {
    super();
    this.name = undefined;
    this.size = undefined;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
  }

  protected override createRenderRoot() {
    return this;
  }

  protected override updated(_changedProperties: PropertyValues<this>) {
    if (this.size === undefined) {
      this.style.removeProperty("width");
      this.style.removeProperty("height");
    } else {
      const size = `${this.size}px`;
      this.style.width = size;
      this.style.height = size;
    }

    for (const svg of this.querySelectorAll("svg")) {
      if (this.size === undefined) {
        svg.style.removeProperty("width");
        svg.style.removeProperty("height");
      } else {
        const size = `${this.size}px`;
        svg.style.width = size;
        svg.style.height = size;
      }
    }
  }

  override render() {
    const icon = this.name ? icons[this.name] : undefined;
    return icon ? html`${unsafeSVG(icon)}` : nothing;
  }
}

customElements.define("app-icon", AppIcon);
