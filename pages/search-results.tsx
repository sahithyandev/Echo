import { Html } from "@elysiajs/html";
import { AlbumArt } from "../components/album-art";
import { formatDuration, unused } from "../utils/misc";

unused(Html);

type Artist = { id: number; name: string };
type Album = { id: number; title: string; cover_path: string | null };
type Track = {
	id: number;
	title: string;
	duration_seconds: number | null;
	artists: Artist[];
	album: { id: number; title: string; cover_path: string | null } | null;
};

export function SearchResults({
	artists,
	albums,
	tracks,
}: {
	artists: Artist[];
	albums: Album[];
	tracks: Track[];
}) {
	if (!artists.length && !albums.length && !tracks.length) {
		return <p class="p-4 text-sm text-muted">No results.</p>;
	}

	return (
		<div class="flex flex-col gap-4 p-3">
			{artists.length > 0 && (
				<section>
					<p class="px-2 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
						Artists
					</p>
					{artists.map((a) => (
						<a
							href={`/artist/${a.id}`}
							class="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface transition-colors"
						>
							<span class="text-sm">{a.name}</span>
						</a>
					))}
				</section>
			)}

			{albums.length > 0 && (
				<section>
					<p class="px-2 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
						Albums
					</p>
					{albums.map((a) => (
						<a
							href={`/album/${a.id}`}
							class="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface transition-colors"
						>
							<AlbumArt size={28} src={a.cover_path} />
							<span class="text-sm">{a.title}</span>
						</a>
					))}
				</section>
			)}

			{tracks.length > 0 && (
				<section>
					<p class="px-2 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
						Tracks
					</p>
					{tracks.map((t) => (
						<div
							class="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface transition-colors cursor-pointer"
							data-track-id={String(t.id)}
							data-title={t.title}
							data-artist={t.artists.map((a) => a.name).join(", ")}
							data-art={t.album?.cover_path ?? ""}
						>
							<AlbumArt size={28} src={t.album?.cover_path ?? null} />
							<div class="min-w-0 flex-1">
								<p class="text-sm truncate">{t.title}</p>
								<p class="text-xs text-muted truncate">
									{t.artists.length
										? t.artists.map((a) => a.name).join(", ")
										: "—"}
								</p>
							</div>
							<span class="text-xs text-muted tabular-nums">
								{formatDuration(t.duration_seconds)}
							</span>
						</div>
					))}
				</section>
			)}
		</div>
	);
}
