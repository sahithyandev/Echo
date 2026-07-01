import { Html } from "@elysiajs/html";
import { AlbumArt } from "../components/album-art";
import { Nav } from "../components/nav";
import { formatDuration, unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type Track = {
	id: number;
	title: string;
	duration_seconds: number | null;
	track_number: number | null;
};
type Album = {
	id: number;
	title: string;
	year: number | null;
	genre: string | null;
	cover_path: string | null;
};

type Artist = { id: number; name: string };

export function AlbumPage({
	album,
	tracks,
	artists,
}: {
	album: Album;
	tracks: Track[];
	artists: Artist[];
}) {
	const artistNames = artists.map((a) => a.name).join(", ");
	return (
		<Layout title={`Echo — ${album.title}`}>
			<div class="min-h-screen flex flex-col">
				<Nav active="albums" />

				<main class="flex-1 flex flex-col p-6 gap-6">
					<div class="flex items-center gap-4">
						<AlbumArt size={56} src={album.cover_path} />
						<div>
							<p class="text-xs text-accent font-medium uppercase tracking-wide mb-0.5">
								Album
							</p>
							<h1 class="text-2xl font-bold tracking-tight font-display">
								{album.title}
							</h1>
							<p class="text-xs text-muted mt-1">
								{artists.map((a, i) => (
									<>
										{i > 0 ? ", " : ""}
										<a
											href={`/artist/${a.id}`}
											class="hover:text-foreground hover:underline"
										>
											{a.name}
										</a>
									</>
								))}
								{album.year ? ` · ${album.year}` : ""}
								{album.genre ? ` · ${album.genre}` : ""}
							</p>
						</div>
					</div>

					<table class="w-full text-sm border-collapse">
						<thead>
							<tr class="border-b border-border text-left text-xs text-muted">
								<th class="pb-2 pr-4 font-medium w-8">#</th>
								<th class="pb-2 font-medium">Title</th>
								<th class="pb-2 font-medium text-right">Duration</th>
							</tr>
						</thead>
						<tbody>
							{tracks.map((t) => (
								<tr
									class="border-b border-border/50 hover:bg-surface/40 transition-colors cursor-pointer"
									data-track-id={String(t.id)}
									data-title={t.title}
									data-artist={artistNames}
								>
									<td class="py-3 pr-4 text-xs w-8">
										<span class="track-number text-muted">
											{t.track_number ?? "—"}
										</span>
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
										{formatDuration(t.duration_seconds)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</main>
			</div>
		</Layout>
	);
}
