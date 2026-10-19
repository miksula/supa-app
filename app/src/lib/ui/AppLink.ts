import { html, LitElement } from "lit";
import { router } from "@packages/router";

const props = {
  text: { type: String },
  to: { type: String },
  active: { type: Boolean },
};

class AppLink extends LitElement {
  static override properties = props;

  /** The text content of the link. */
  public text: string;
  /** The target route/path of the link. */
  public to: string;
  /** Whether the link is currently active. */
  public active?: boolean;

  constructor() {
    super();
    this.text = "";
    this.to = "/";
    this.active = false;
  }

  protected override createRenderRoot() {
    return this; // no shadow DOM
  }

  override render() {
    return html`
      <a
        class="app-link"
        href="${this.to}"
        @click="${this.handleClick}"
        aria-current="${this.active ? "page" : "false"}"
      >
        ${this.text}
      </a>
    `;
  }

  private handleClick = (event: Event) => {
    event.preventDefault();
    router.navigate(this.to);
  };
}

customElements.define("app-link", AppLink);
