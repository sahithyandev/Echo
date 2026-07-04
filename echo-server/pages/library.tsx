import { Html } from "@elysiajs/html";
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

const OK_MESSAGES: Record<string, string> = {
	upload: "Files uploaded. Rescanning library.",
	rename: "Track renamed.",
};

const ERROR_MESSAGES: Record<string, string> = {
	upload:
		"No files were uploaded. Check the file types (mp3, flac, m4a, aac, ogg, wav) and that they don't already exist.",
	rename: "Couldn't rename track.",
};

export function LibraryPage({
	name,
	tracks,
	isAdmin,
	ok,
	error,
}: {
	name: string;
	tracks: Track[];
	isAdmin: boolean;
	ok?: string;
	error?: string;
}) {
	return (
		<Layout title="Echo — Library" active="library">
			<main class="flex-1 flex flex-col p-6 gap-6">
				<div class="flex items-center justify-between gap-4">
					<p class="text-sm text-muted">
						Welcome back, <span class="text-accent font-medium">{name}</span>
					</p>
					{isAdmin && (
						<button
							id="upload-open"
							type="button"
							class="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium px-3 py-1.5 transition-opacity hover:opacity-90 cursor-pointer"
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
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							Add tracks
						</button>
					)}
				</div>

				{isAdmin && (
					<dialog
						id="upload-dialog"
						class="backdrop:bg-black/50 bg-surface border border-border rounded-xl p-6 w-full max-w-md text-foreground m-auto"
					>
						<form
							id="upload-form"
							method="post"
							action="/library/upload"
							enctype="multipart/form-data"
							class="flex flex-col gap-4"
						>
							<div class="flex items-center justify-between">
								<h2 class="text-sm font-semibold">Add tracks</h2>
								<button
									type="button"
									id="upload-close"
									aria-label="Close"
									class="text-muted hover:text-foreground cursor-pointer"
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>

							<label
								for="upload-files"
								id="upload-dropzone"
								class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-accent transition-colors"
							>
								<svg
									width="28"
									height="28"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-accent"
									aria-hidden="true"
								>
									<path d="M12 16V4M12 4l-4 4M12 4l4 4" />
									<path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
								</svg>
								<p class="text-sm text-muted">
									Drag and drop audio files here, or{" "}
									<span class="text-accent">browse</span>
								</p>
								<p class="text-xs text-subtle">mp3, flac, m4a, aac, ogg, wav</p>
							</label>
							<div
								id="upload-file-list"
								class="flex flex-col gap-2 max-h-40 overflow-y-auto empty:hidden"
							/>
							<input
								id="upload-files"
								name="files"
								type="file"
								multiple
								accept=".mp3,.flac,.m4a,.aac,.ogg,.wav"
								required
								class="hidden"
							/>

							<div class="flex justify-end gap-2">
								<button
									type="button"
									id="upload-cancel"
									class="rounded-md border border-border text-sm font-medium px-4 py-2 text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="rounded-md bg-accent text-accent-foreground text-sm font-medium px-4 py-2 transition-opacity hover:opacity-90 cursor-pointer"
								>
									Upload
								</button>
							</div>
						</form>
					</dialog>
				)}

				{ok && (
					<p class="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
						{OK_MESSAGES[ok] ?? "Saved."}
					</p>
				)}
				{error && (
					<p class="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-md px-3 py-2">
						{ERROR_MESSAGES[error] ?? "Something went wrong."}
					</p>
				)}

				{tracks.length === 0 ? (
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
									{isAdmin && (
										<form
											method="post"
											action={`/track/${t.id}/delete`}
											class="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
											onclick="event.stopPropagation()"
											onsubmit={`return confirm(${JSON.stringify(`Delete "${t.title}"? This removes the file from disk.`)})`}
										>
											<button
												type="submit"
												title="Delete track"
												aria-label="Delete track"
												class="flex items-center justify-center w-6 h-6 rounded-md bg-background/80 text-muted hover:text-red-400 hover:bg-background"
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
													<polyline points="3,6 5,6 21,6" />
													<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
												</svg>
											</button>
										</form>
									)}
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
								{isAdmin ? (
									<details
										class="track-rename"
										onclick="event.stopPropagation()"
									>
										<summary class="flex items-center gap-1 text-xs font-medium truncate track-title list-none cursor-pointer">
											<span class="truncate">{t.title}</span>
											<svg
												width="11"
												height="11"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="shrink-0 text-muted opacity-0 group-hover:opacity-70"
												aria-hidden="true"
											>
												<path d="M12 20h9" />
												<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
											</svg>
										</summary>
										<form
											method="post"
											action={`/track/${t.id}/rename`}
											class="flex gap-1 mt-1"
										>
											<input type="hidden" name="return" value="/library" />
											<input
												name="title"
												value={t.title}
												required
												autofocus
												class="w-0 flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-xs"
											/>
											<button
												type="submit"
												class="shrink-0 rounded bg-accent text-accent-foreground text-xs px-2"
											>
												Save
											</button>
										</form>
									</details>
								) : (
									<p class="text-xs font-medium truncate track-title">
										{t.title}
									</p>
								)}
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
				)}
			</main>
		</Layout>
	);
}
