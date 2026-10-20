import "./app-icon.css";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { createElement } from "lucide";
import { config } from "@/config.ts";
import { appIcons, isAppIconName, resolveIcon, type AppIconName } from "./icons.ts";

/**
 * Renders an icon from the registry in `./icons.ts` (see that file for adding icons).
 *
 * Usage: `<app-icon name="next" size="16"></app-icon>`
 * - `size`: width/height in px. Defaults to 1em, so the icon scales with the font size.
 * - `stroke-width`: stroke width in px (default 1.75).
 *
 * Icons are decorative (`aria-hidden`). Put an accessible label on the surrounding control.
 */
class AppIcon extends LitElement {
  static override properties = {
    name: { type: String },
    size: { type: Number },
    strokeWidth: { type: Number, attribute: "stroke-width" },
  };

  public name: AppIconName | undefined;
  public size: number | undefined;
  public strokeWidth: number;

  constructor() {
    super();
    this.name = undefined;
    this.size = undefined;
    this.strokeWidth = 1.75;
  }

  protected override createRenderRoot() {
    return this;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("size")) {
      const size = this.size === undefined ? "" : `${this.size}px`;
      this.style.width = size;
      this.style.height = size;
    }
  }

  override render() {
    if (!this.name) return nothing;
    if (!isAppIconName(this.name)) {
      if (config.isDevelopment) console.warn(`<app-icon>: unknown icon name "${this.name}"`);
      return nothing;
    }

    const { node, attrs } = resolveIcon(appIcons[this.name]);
    return html`${createElement(node, {
      ...attrs,
      "stroke-width": this.strokeWidth,
      "aria-hidden": "true",
      focusable: "false",
    })}`;
  }
}

customElements.define("app-icon", AppIcon);
