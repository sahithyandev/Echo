import { Html } from "@elysiajs/html";
import { AlbumArt } from "../components/album-art";
import { Flash } from "../components/flash";
import { formatDuration, unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type Track = { id: number; title: string; duration_seconds: number | null };

const OK_MESSAGES: Record<string, string> = {
	rename: "Artist renamed.",
	merge: "Artist merged into the existing artist with that name.",
};

const ERROR_MESSAGES: Record<string, string> = {
	rename: "Couldn't rename artist.",
};

export function ArtistPage({
	artist,
	tracks,
	playCounts = new Map(),
	isAdmin,
	signedIn = true,
	ok,
	error,
}: {
	artist: { id: number; name: string };
	tracks: Track[];
	playCounts?: Map<number, number>;
	isAdmin: boolean;
	signedIn?: boolean;
	ok?: string;
	error?: string;
}) {
	return (
		<Layout title={artist.name} active="artists" signedIn={signedIn}>
			<main class="flex-1 flex flex-col p-4 sm:p-6 gap-6">
				<Flash variant="ok" message={ok && (OK_MESSAGES[ok] ?? "Saved.")} />
				<Flash
					variant="error"
					message={error && (ERROR_MESSAGES[error] ?? "Something went wrong.")}
				/>
				<div class="flex items-center gap-4">
					<AlbumArt size={56} />
					<div>
						<p class="text-xs text-accent font-medium uppercase tracking-wide mb-0.5">
							Artist
						</p>
						<div class="flex items-center gap-2">
							<h1 class="text-2xl font-bold tracking-tight font-display">
								{artist.name}
							</h1>
							{isAdmin && (
								<details class="relative">
									<summary
										title="Rename artist"
										aria-label="Rename artist"
										class="flex items-center justify-center w-6 h-6 rounded-md text-muted hover:text-foreground hover:bg-surface list-none cursor-pointer"
									>
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
											<path d="M12 20h9" />
											<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
										</svg>
									</summary>
									<form
										method="post"
										action={`/artist/${artist.id}/rename`}
										class="absolute top-8 left-0 z-20 flex gap-1 bg-surface border border-border rounded-md p-1.5 shadow-lg"
									>
										<input
											name="name"
											value={artist.name}
											required
											class="w-48 rounded border border-border bg-background px-1.5 py-1 text-xs"
										/>
										<button
											type="submit"
											class="rounded bg-accent text-accent-foreground text-xs px-2"
										>
											Save
										</button>
									</form>
								</details>
							)}
						</div>
						<p class="text-xs text-muted mt-1">
							{tracks.length} track{tracks.length !== 1 ? "s" : ""}
						</p>
					</div>
				</div>

				<table class="w-full text-sm border-collapse">
					<thead>
						<tr class="border-b border-border text-left text-xs text-muted">
							<th class="pb-2 pr-4 font-medium w-8">#</th>
							<th class="pb-2 font-medium">Title</th>
							<th class="pb-2 font-medium text-right">Plays</th>
							<th class="pb-2 font-medium text-right">Duration</th>
						</tr>
					</thead>
					<tbody>
						{tracks.map((t, i) => (
							<tr
								class="border-b border-border/50 hover:bg-surface/40 transition-colors cursor-pointer"
								data-track-id={String(t.id)}
								data-title={t.title}
								data-artist={artist.name}
							>
								<td class="py-3 pr-4 text-xs w-8">
									<span class="track-number text-muted">{i + 1}</span>
									<svg
										class="track-play-hover"
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="currentColor"
										aria-hidden="true"
									>
										<polygon points="6,3 20,12 6,21" />
									</svg>
									<span class="track-bars" aria-hidden="true">
										<span />
										<span />
										<span />
									</span>
								</td>
								<td class="py-3 font-medium track-title">{t.title}</td>
								<td class="py-3 text-muted text-right tabular-nums">
									{playCounts.get(t.id) ?? 0}
								</td>
								<td class="py-3 text-muted text-right tabular-nums">
									{formatDuration(t.duration_seconds)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</main>
		</Layout>
	);
}
