import { html, nothing, render } from "lit";
import "./login.css";
import type { Dispose } from "@/types.ts";

export type LoginProps = {
  login: (email: string, password: string) => Promise<void>;
  initialEmail?: string;
  initialPassword?: string;
};

export function LoginPage(el: HTMLElement, props: LoginProps): Dispose {
  let disposed = false;
  let isSubmitting = false;
  let email = props.initialEmail ?? "";
  let password = props.initialPassword ?? "";
  let statusMessage: string | null = null;

  const renderComponent = () => {
    if (disposed) return;
    render(
      html`
        <div class="login" data-component="login">
          <header class="login-header">
            <h1 id="login-heading" class="login-title">Sign in</h1>
            <p class="login-description">Use your account email address and password.</p>
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
              ${isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      `,
      el,
    );
  };

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (disposed || isSubmitting || !(event.currentTarget instanceof HTMLFormElement)) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    email = String(formData.get("email") ?? "").trim();
    password = String(formData.get("password") ?? "");

    isSubmitting = true;
    statusMessage = null;
    renderComponent();

    try {
      await props.login(email, password);
    } catch (error) {
      if (disposed) return;
      console.error("Failed to sign in", error);
      statusMessage = "Sign-in failed. Check your credentials and try again.";
    } finally {
      isSubmitting = false;
      renderComponent();
    }
  }

  renderComponent();

  return () => {
    if (disposed) return;
    disposed = true;
    render(nothing, el);
  };
}
