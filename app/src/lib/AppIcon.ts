import { html, LitElement, nothing } from "lit";
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
} as const;

type AppIconName = keyof typeof icons;

class AppIcon extends LitElement {
  static override properties = {
    name: { type: String },
  };

  public name: AppIconName | undefined;

  constructor() {
    super();
    this.name = undefined;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute("aria-hidden", "true");
  }

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    const icon = this.name ? icons[this.name] : undefined;
    return icon ? html`${unsafeSVG(icon)}` : nothing;
  }
}

customElements.define("app-icon", AppIcon);
