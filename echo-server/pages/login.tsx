import { Html } from "@elysiajs/html";
import { Layout } from "./layout";

export function LoginPage() {
  return (
    <Layout title="Echo — Login">
      <div class="wordmark">Echo</div>

      <form class="login-form" method="post" action="/auth/login">
        <div class="field">
          <label for="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autocomplete="username"
            required
            autofocus
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>
        <button type="submit" class="cta">
          Sign in
        </button>
      </form>
    </Layout>
  );
}
