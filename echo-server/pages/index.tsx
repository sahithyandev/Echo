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
						<h1 class="wordmark-gradient text-5xl font-bold font-display">
							Echo
						</h1>
						<p class="text-sm text-muted">Your personal music library</p>
					</div>

					<div class="flex flex-col gap-2 w-full text-left">
						<div class="flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
							<span class="shrink-0 w-7 h-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M9 18V5l12-2v13" />
									<circle cx="6" cy="18" r="3" />
									<circle cx="18" cy="16" r="3" />
								</svg>
							</span>
							<span class="text-sm text-muted leading-relaxed">
								<strong class="text-foreground font-medium">
									Own your music.
								</strong>{" "}
								Stream from your own collection, not a subscription.
							</span>
						</div>
						<div class="flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
							<span class="shrink-0 w-7 h-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
								</svg>
							</span>
							<span class="text-sm text-muted leading-relaxed">
								<strong class="text-foreground font-medium">
									Organized library.
								</strong>{" "}
								Albums, artists, and tracks — automatically sorted.
							</span>
						</div>
						<div class="flex items-start gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3">
							<span class="shrink-0 w-7 h-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
								</svg>
							</span>
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
						class="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground text-sm font-medium px-5 py-2.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						Open Library
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<line x1="5" y1="12" x2="19" y2="12" />
							<polyline points="12 5 19 12 12 19" />
						</svg>
					</a>
				</div>
			</div>
		</Layout>
	);
}
