import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

export function LoginPage({
	register,
	error,
}: {
	register: boolean;
	error?: boolean;
}) {
	const action = register ? "/auth/sign-up" : "/auth/sign-in";
	const heading = register ? "Create admin account" : "Sign in";
	const submit = register ? "Create account" : "Sign in";

	return (
		<Layout title="Echo — Login">
			<div class="wordmark">Echo</div>

			<form class="login-form" method="post" action={action}>
				<p class="form-heading">{heading}</p>
				{error && (
					<p class="form-error">Invalid email or password. Please try again.</p>
				)}
				<div class="field">
					<label for="email">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
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
						autocomplete={register ? "new-password" : "current-password"}
						required
					/>
					{register && (
						<span class="field-hint">
							8+ chars, upper &amp; lower case, number, special character
						</span>
					)}
				</div>
				<button type="submit" class="cta">
					{submit}
				</button>
			</form>
		</Layout>
	);
}
