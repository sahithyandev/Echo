import { Html } from "@elysiajs/html";
import { Layout } from "./layout";

export function IndexPage() {
	return (
		<Layout title="Echo">
			<div class="wordmark">Echo</div>
			<p class="tagline">Your personal music library</p>

			<div class="features">
				<div class="feature">
					<span class="feature-icon">🎵</span>
					<span class="feature-text">
						<strong>Own your music.</strong> Stream from your own collection,
						not a subscription.
					</span>
				</div>
				<div class="feature">
					<span class="feature-icon">📂</span>
					<span class="feature-text">
						<strong>Organized library.</strong> Albums, artists, and tracks —
						automatically sorted.
					</span>
				</div>
				<div class="feature">
					<span class="feature-icon">⚡</span>
					<span class="feature-text">
						<strong>Fast and local.</strong> Runs on your machine, nothing
						leaves your network.
					</span>
				</div>
			</div>

			<a class="cta" href="/library">
				Open Library
			</a>
		</Layout>
	);
}
