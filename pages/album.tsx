import { Html } from "@elysiajs/html";
import { AlbumArt } from "../components/album-art";
import { Flash } from "../components/flash";
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

const OK_MESSAGES: Record<string, string> = {
	rename: "Album renamed.",
	merge: "Album merged into the existing album with that title.",
};

const ERROR_MESSAGES: Record<string, string> = {
	rename: "Couldn't rename album.",
};

export function AlbumPage({
	album,
	tracks,
	artists,
	isAdmin,
	ok,
	error,
}: {
	album: Album;
	tracks: Track[];
	artists: Artist[];
	isAdmin: boolean;
	ok?: string;
	error?: string;
}) {
	const artistNames = artists.map((a) => a.name).join(", ");
	return (
		<Layout title={album.title} active="albums">
			<main class="flex-1 flex flex-col p-4 sm:p-6 gap-6">
				<Flash variant="ok" message={ok && (OK_MESSAGES[ok] ?? "Saved.")} />
				<Flash
					variant="error"
					message={error && (ERROR_MESSAGES[error] ?? "Something went wrong.")}
				/>
				<div class="flex items-center gap-4">
					<AlbumArt size={56} src={album.cover_path} />
					<div>
						<p class="text-xs text-accent font-medium uppercase tracking-wide mb-0.5">
							Album
						</p>
						<div class="flex items-center gap-2">
							<h1 class="text-2xl font-bold tracking-tight font-display">
								{album.title}
							</h1>
							{isAdmin && album.id !== 0 && (
								<details class="relative">
									<summary
										title="Rename album"
										aria-label="Rename album"
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
										action={`/album/${album.id}/rename`}
										class="absolute top-8 left-0 z-20 flex gap-1 bg-surface border border-border rounded-md p-1.5 shadow-lg"
									>
										<input
											name="title"
											value={album.title}
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
							{isAdmin && <th class="pb-2 pl-2 font-medium w-8" />}
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
								{isAdmin && (
									<td class="py-3 pl-2 text-right">
										<details
											class="relative inline-block"
											onclick="event.stopPropagation()"
										>
											<summary
												title="Rename track"
												aria-label="Rename track"
												class="flex items-center justify-center w-6 h-6 rounded-md text-muted hover:text-foreground hover:bg-background list-none cursor-pointer"
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
												action={`/track/${t.id}/rename`}
												class="absolute top-7 right-0 z-20 flex gap-1 bg-surface border border-border rounded-md p-1.5 shadow-lg"
											>
												<input
													type="hidden"
													name="return"
													value={`/album/${album.id}`}
												/>
												<input
													name="title"
													value={t.title}
													required
													class="w-32 rounded border border-border bg-background px-1.5 py-1 text-xs"
												/>
												<button
													type="submit"
													class="rounded bg-accent text-accent-foreground text-xs px-2"
												>
													Save
												</button>
											</form>
										</details>
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</main>
		</Layout>
	);
}
