import { html, render } from "lit";
import { authService } from "@/lib/auth.ts";

export function Login(el) {
  let isSubmitting = false;
  let email = "mika@example.com";
  let password = "My1234NewStrongPassword!";
  let statusMessage: string | null = null;

  const renderComponent = () => {
    render(
      html`
        <div class="login">
          <h1 id="login-heading">Login to your account</h1>
          <p>Enter your email and password below to login to your account</p>

          <form aria-labelledby="login-heading" @submit="${handleSubmit}">
            <label for="email">Email</label>
            <input
              class="mb-8"
              type="email"
              id="email"
              name="email"
              autocomplete="username"
              value="${email}"
              required
            />

            <label for="current-password">Password</label>
            <input
              type="password"
              id="current-password"
              name="password"
              autocomplete="current-password"
              value="${password}"
              required
            />

            <p
              id="login-status"
              class="my-4"
              role="alert"
              aria-live="assertive"
              aria-hidden="${statusMessage === null ? "true" : "false"}"
            >
              ${statusMessage ?? ""}
            </p>

            <button
              class="mt-4"
              type="submit"
              ?disabled="${isSubmitting}"
              aria-busy="${isSubmitting}"
            >
              Login
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
