import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";
import { AlbumArt, formatDuration } from "./shared";

unused(Html);

type Track = {
	id: number;
	title: string;
	duration_seconds: number | null;
	artists: { id: number; name: string }[];
	album: { id: number; title: string } | null;
};

export function LibraryPage({
	name,
	tracks,
}: {
	name: string;
	tracks: Track[];
}) {
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

				<main class="flex-1 flex flex-col p-6 gap-4">
					<p class="text-sm text-muted">
						Welcome back,{" "}
						<span class="text-foreground font-medium">{name}</span>
					</p>

					{tracks.length === 0 ? (
						<div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
							<div class="flex items-center justify-center w-14 h-14 rounded-full bg-surface border border-border text-2xl mb-2">
								♫
							</div>
							<p class="text-sm text-muted">Your library is empty.</p>
							<p class="text-xs text-subtle">Add music files to get started.</p>
						</div>
					) : (
						<table class="w-full text-sm border-collapse">
							<thead>
								<tr class="border-b border-border text-left text-xs text-muted">
									<th class="pb-2 pr-4 font-medium w-8">#</th>
									<th class="pb-2 pr-3 font-medium w-10"></th>
									<th class="pb-2 pr-4 font-medium">Title</th>
									<th class="pb-2 pr-4 font-medium">Artist</th>
									<th class="pb-2 pr-4 font-medium">Album</th>
									<th class="pb-2 font-medium text-right">Duration</th>
								</tr>
							</thead>
							<tbody>
								{tracks.map((t, i) => (
									<tr class="border-b border-border/50 hover:bg-surface/40 transition-colors">
										<td class="py-2 pr-4 text-muted text-xs">{i + 1}</td>
										<td class="py-2 pr-3">
											<AlbumArt />
										</td>
										<td class="py-2 pr-4 font-medium">{t.title}</td>
										<td class="py-2 pr-4 text-muted">
											{t.artists.length === 0
												? "—"
												: t.artists.map((a, i) => (
														<>
															{i > 0 && ", "}
															<a
																href={`/artist/${a.id}`}
																class="hover:text-foreground transition-colors"
															>
																{a.name}
															</a>
														</>
													))}
										</td>
										<td class="py-2 pr-4 text-muted">
											{t.album ? (
												<a
													href={`/album/${t.album.id}`}
													class="hover:text-foreground transition-colors"
												>
													{t.album.title}
												</a>
											) : (
												"—"
											)}
										</td>
										<td class="py-2 text-muted text-right tabular-nums">
											{formatDuration(t.duration_seconds)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</main>
			</div>
		</Layout>
	);
}
