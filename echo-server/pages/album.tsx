import { Html } from "@elysiajs/html";
import { AlbumArt } from "../components/album-art";
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

export function AlbumPage({
	album,
	tracks,
	artists,
}: {
	album: Album;
	tracks: Track[];
	artists: string[];
}) {
	return (
		<Layout title={`Echo — ${album.title}`}>
			<div class="min-h-screen flex flex-col">
				<header class="flex items-center justify-between px-6 py-4 border-b border-border">
					<a
						href="/library"
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

				<main class="flex-1 flex flex-col p-6 gap-6">
					<div class="flex items-center gap-4">
						<AlbumArt size={56} />
						<div>
							<p class="text-xs text-muted mb-0.5">Album</p>
							<h1 class="text-2xl font-bold tracking-tight">{album.title}</h1>
							<p class="text-xs text-muted mt-1">
								{artists.join(", ")}
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
								<tr class="border-b border-border/50 hover:bg-surface/40 transition-colors">
									<td class="py-2 pr-4 text-muted text-xs">
										{t.track_number ?? "—"}
									</td>
									<td class="py-2 font-medium">{t.title}</td>
									<td class="py-2 text-muted text-right tabular-nums">
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
