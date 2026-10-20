import { html, render } from "lit";
import { authService } from "@/auth/auth.ts";

export function LoginPage(el: HTMLElement) {
  let isSubmitting = false;
  // Dev-only prefill from app/.env.local; production builds start empty.
  let email = import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL ?? "") : "";
  let password = import.meta.env.DEV ? (import.meta.env.VITE_DEV_PASSWORD ?? "") : "";
  let statusMessage: string | null = null;

  const renderComponent = () => {
    render(
      html`
        <div class="login" data-component="login-page">
          <header class="login-header">
            <h1 id="login-heading" class="login-title">Login to your account</h1>
            <p class="login-description">
              Enter your email and password below to login to your account
            </p>
          </header>

          <form
            class="login-form"
            aria-labelledby="login-heading"
            @submit="${(e: SubmitEvent) => handleSubmit(e)}"
          >
            <div class="form-field">
              <label class="form-label" for="email">Email</label>
              <input
                class="form-input"
                type="email"
                id="email"
                name="email"
                autocomplete="username"
                value="${email}"
                required
              />
            </div>

            <div class="form-field">
              <label class="form-label" for="current-password">Password</label>
              <input
                class="form-input"
                type="password"
                id="current-password"
                name="password"
                autocomplete="current-password"
                value="${password}"
                required
              />
            </div>

            <p
              id="login-status"
              class="login-status"
              role="alert"
              aria-live="assertive"
              aria-hidden="${statusMessage === null ? "true" : "false"}"
            >
              ${statusMessage ?? ""}
            </p>

            <button
              class="login-submit"
              type="submit"
              ?disabled="${isSubmitting}"
              aria-busy="${isSubmitting}"
            >
              ${isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      `,
      el,
    );
  };

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting || !(event.currentTarget instanceof HTMLFormElement)) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    email = String(formData.get("email") ?? "").trim();
    password = String(formData.get("password") ?? "");

    isSubmitting = true;
    statusMessage = null;
    renderComponent();

    try {
      await authService.login(email, password);
    } catch (error) {
      statusMessage =
        error instanceof Error ? error.message : "Unable to sign in. Please try again.";
    } finally {
      isSubmitting = false;
      renderComponent();
    }
  }

  renderComponent();
}
