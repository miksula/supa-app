import { html } from "lit";
import "./AppIcon.ts";

export function Accordion() {
  const handleToggle = (event: Event) => {
    const button = event.currentTarget as HTMLElement;
    const item = button.closest(".accordion-item");
    if (!item) return;

    const isOpen = item.classList.contains("-is-open");
    item.classList.toggle("-is-open", !isOpen);
    button.setAttribute("aria-expanded", String(!isOpen));
  };

  return html`
    <div class="accordion" data-component="accordion">
      <div class="accordion-item -is-open" id="payment-basic">
        <button
          type="button"
          class="accordion-toggle"
          aria-controls="payment-basic-collapse"
          aria-expanded="true"
          @click=${handleToggle}
        >
          <app-icon name="plus" size="18" class="accordion-icon"></app-icon>
          <span class="accordion-title">When is payment taken for my order?</span>
        </button>
        <div
          id="payment-basic-collapse"
          class="accordion-content"
          aria-labelledby="payment-basic"
          role="region"
        >
          <div class="accordion-body">
            <p class="text-sm leading-relaxed text-(--muted-foreground)">
              Payment is taken during the checkout process when you pay for your order. The order
              number that appears on the confirmation screen indicates payment has been successfully
              processed.
            </p>
          </div>
        </div>
      </div>

      <div class="accordion-item" id="delivery-basic">
        <button
          type="button"
          class="accordion-toggle"
          aria-controls="delivery-basic-collapse"
          aria-expanded="false"
          @click=${handleToggle}
        >
          <app-icon name="plus" size="18" class="accordion-icon"></app-icon>
          <span class="accordion-title">How would you ship my order?</span>
        </button>
        <div
          id="delivery-basic-collapse"
          class="accordion-content"
          aria-labelledby="delivery-basic"
          role="region"
        >
          <div class="accordion-body">
            <p class="text-sm leading-relaxed text-(--muted-foreground)">
              For large products, we deliver your product via a third party logistics company offering
              you the “room of choice” scheduled delivery service. For small products, we offer free
              parcel delivery.
            </p>
          </div>
        </div>
      </div>

      <div class="accordion-item" id="cancel-basic">
        <button
          type="button"
          class="accordion-toggle"
          aria-controls="cancel-basic-collapse"
          aria-expanded="false"
          @click=${handleToggle}
        >
          <app-icon name="plus" size="18" class="accordion-icon"></app-icon>
          <span class="accordion-title">Can I cancel my order?</span>
        </button>
        <div
          id="cancel-basic-collapse"
          class="accordion-content"
          aria-labelledby="cancel-basic"
          role="region"
        >
          <div class="accordion-body">
            <p class="text-sm leading-relaxed text-(--muted-foreground)">
              Scheduled delivery orders can be cancelled 72 hours prior to your selected delivery date
              for full refund.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

