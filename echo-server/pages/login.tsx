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
			<div class="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
				<a href="/" class="wordmark-gradient text-3xl font-bold font-display">
					Echo
				</a>

				<div class="w-full max-w-xs bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
					<p class="text-sm font-semibold text-foreground">{heading}</p>

					{error && (
						<p class="text-xs text-red-400 -mt-1">
							Invalid email or password. Please try again.
						</p>
					)}

					<form class="flex flex-col gap-4" method="post" action={action}>
						<div class="flex flex-col gap-1.5">
							<label for="email" class="text-xs font-medium text-muted">
								Email
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autocomplete="email"
								required
								autofocus
								class="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<label for="password" class="text-xs font-medium text-muted">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autocomplete={register ? "new-password" : "current-password"}
								required
								class="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
							/>
							{register && (
								<span class="text-xs text-subtle">
									8+ chars, upper &amp; lower case, number, special character
								</span>
							)}
						</div>

						<button
							type="submit"
							class="w-full rounded-md bg-accent text-accent-foreground text-sm font-medium px-4 py-2.5 mt-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
						>
							{submit}
						</button>
					</form>
				</div>
			</div>
		</Layout>
	);
}
