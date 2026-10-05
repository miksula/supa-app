import { html, render } from "lit";
import { supabase } from "@/lib/client.ts";

export function Login(el) {
  let isSubmitting = false;

  const loginTemplate = () =>
    html`
      <div class="login">
        <h1 id="login-heading">Login to your account</h1>
        <p
          class="login-intro">Enter your email and password below to login to your account</p>

        <form aria-labelledby="login-heading">
          <label for="email">Email</label>
          <input
            class="mb-8"
            type="email"
            id="email"
            name="email"
            autocomplete="username"
            value="mika@example.com"
            required
          >

          <label for="current-password">Password</label>
          <input
            type="password"
            id="current-password"
            name="password"
            autocomplete="current-password"
            value="My1234NewStrongPassword!"
            required
          >

          <p id="login-status" class="my-4" role="alert" aria-live="assertive"
            aria-hidden="true">Lorem ipsum dolor sit amet</p>

          <button class="mt-4" type="submit">Login</button>
        </form>
      </div>
    `;

  render(loginTemplate(), el);

  const form = el.querySelector("form");
  const status = el.querySelector("#login-status");
  const submitButton = form?.querySelector('button[type="submit"]');

  form.addEventListener("submit", async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    status.setAttribute("aria-hidden", "true");
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      await supabase.login(email, password);
    } catch (error) {
      status.textContent = error instanceof Error
        ? error.message
        : "Unable to sign in. Please try again.";
      status.removeAttribute("aria-hidden");
    } finally {
      isSubmitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  });
}
