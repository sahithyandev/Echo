import { Html } from "@elysiajs/html";
import { Nav } from "../components/nav";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type Track = {
	id: number;
	title: string;
	duration_seconds: number | null;
	artists: { id: number; name: string }[];
	album: { id: number; title: string; cover_path: string | null } | null;
};

function TrackGrid({ tracks }: { tracks: Track[] }) {
	return (
		<div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
			{tracks.map((t) => (
				<div
					class="group cursor-pointer"
					data-track-id={String(t.id)}
					data-title={t.title}
					data-artist={t.artists.map((a) => a.name).join(", ")}
					data-art={t.album?.cover_path ?? ""}
				>
					<div class="relative aspect-square overflow-hidden rounded-md bg-surface mb-2">
						{t.album?.cover_path ? (
							<img
								src={t.album.cover_path}
								class="w-full h-full object-cover"
								alt=""
							/>
						) : (
							<div class="w-full h-full flex items-center justify-center">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-accent opacity-40"
									aria-hidden="true"
								>
									<path d="M9 18V5l12-2v13" />
									<circle cx="6" cy="18" r="3" />
									<circle cx="18" cy="16" r="3" />
								</svg>
							</div>
						)}
						<div class="track-card-hover">
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-hidden="true"
							>
								<polygon points="6,3 20,12 6,21" />
							</svg>
						</div>
						<div class="track-card-playing">
							<div class="track-bars">
								<span />
								<span />
								<span />
							</div>
						</div>
					</div>
					<p class="text-xs font-medium truncate track-title">{t.title}</p>
					<p class="text-xs text-muted truncate">
						{t.artists.length ? (
							t.artists.map((a, i) => (
								<>
									{i > 0 ? ", " : ""}
									<a
										href={`/artist/${a.id}`}
										class="hover:text-foreground hover:underline"
									>
										{a.name}
									</a>
								</>
							))
						) : (
							<>—</>
						)}
					</p>
				</div>
			))}
		</div>
	);
}

function Section({ title, tracks }: { title: string; tracks: Track[] }) {
	if (tracks.length === 0) return null;
	return (
		<section class="flex flex-col gap-3">
			<h2 class="text-sm font-medium text-muted">{title}</h2>
			<TrackGrid tracks={tracks} />
		</section>
	);
}

export function HomePage({
	name,
	continueListening,
	recentlyAdded,
	recentlyPlayed,
}: {
	name: string;
	continueListening: Track | null;
	recentlyAdded: Track[];
	recentlyPlayed: Track[];
}) {
	const isEmpty =
		!continueListening &&
		recentlyAdded.length === 0 &&
		recentlyPlayed.length === 0;

	return (
		<Layout title="Echo — Home">
			<div class="min-h-screen flex flex-col">
				<Nav active="home" />

				<main class="flex-1 flex flex-col p-6 gap-8">
					<p class="text-sm text-muted">
						Welcome back, <span class="text-accent font-medium">{name}</span>
					</p>

					{isEmpty ? (
						<div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
							<div class="flex items-center justify-center w-14 h-14 rounded-full bg-surface border border-border mb-2">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-label="No tracks"
									class="text-accent"
								>
									<path d="M9 18V5l12-2v13" />
									<circle cx="6" cy="18" r="3" />
									<circle cx="18" cy="16" r="3" />
								</svg>
							</div>
							<p class="text-sm text-muted">Your library is empty.</p>
							<p class="text-xs text-subtle">Add music files to get started.</p>
						</div>
					) : (
						<>
							<Section
								title="Continue listening"
								tracks={continueListening ? [continueListening] : []}
							/>
							<Section title="Recently added" tracks={recentlyAdded} />
							<Section title="Recently played" tracks={recentlyPlayed} />
						</>
					)}
				</main>
			</div>
		</Layout>
	);
}
