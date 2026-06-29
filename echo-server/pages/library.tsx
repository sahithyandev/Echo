import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

export function LibraryPage({ name }: { name: string }) {
	return (
		<Layout title="Echo — Library">
			<div class="min-h-screen flex flex-col">
				<header class="flex items-center justify-between px-6 py-4 border-b border-border">
					<a
						href="/"
						class="wordmark-gradient text-xl font-bold tracking-tighter"
					>
						Echo
					</a>
					<form method="post" action="/auth/sign-out">
						<button
							type="submit"
							class="text-xs text-muted hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors hover:bg-surface cursor-pointer"
						>
							Sign out
						</button>
					</form>
				</header>

				<main class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
					<div class="flex items-center justify-center w-14 h-14 rounded-full bg-surface border border-border text-2xl mb-2">
						♫
					</div>
					<p class="text-sm font-medium text-foreground">
						Welcome back, {name}
					</p>
					<p class="text-sm text-muted">Your library is empty.</p>
					<p class="text-xs text-subtle">Add music files to get started.</p>
				</main>
			</div>
		</Layout>
	);
}
