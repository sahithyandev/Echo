import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

export function IndexPage() {
	return (
		<Layout title="Echo">
			<div class="min-h-screen flex items-center justify-center p-8">
				<div class="flex flex-col items-center gap-8 max-w-xs w-full text-center">
					<div class="flex flex-col items-center gap-2">
						<h1 class="wordmark-gradient text-5xl font-bold tracking-tighter">
							Echo
						</h1>
						<p class="text-sm text-muted">Your personal music library</p>
					</div>

					<div class="flex flex-col gap-2 w-full text-left">
						<div class="flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
							<span class="text-base leading-relaxed shrink-0">🎵</span>
							<span class="text-sm text-muted leading-relaxed">
								<strong class="text-foreground font-medium">
									Own your music.
								</strong>{" "}
								Stream from your own collection, not a subscription.
							</span>
						</div>
						<div class="flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
							<span class="text-base leading-relaxed shrink-0">📂</span>
							<span class="text-sm text-muted leading-relaxed">
								<strong class="text-foreground font-medium">
									Organized library.
								</strong>{" "}
								Albums, artists, and tracks — automatically sorted.
							</span>
						</div>
						<div class="flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
							<span class="text-base leading-relaxed shrink-0">⚡</span>
							<span class="text-sm text-muted leading-relaxed">
								<strong class="text-foreground font-medium">
									Fast and local.
								</strong>{" "}
								Runs on your machine, nothing leaves your network.
							</span>
						</div>
					</div>

					<a
						href="/library"
						class="inline-flex items-center gap-2 rounded-md bg-foreground text-background text-sm font-medium px-5 py-2.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						Open Library
						<span aria-hidden="true">→</span>
					</a>
				</div>
			</div>
		</Layout>
	);
}
