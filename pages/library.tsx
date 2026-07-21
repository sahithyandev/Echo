import { Html } from "@elysiajs/html";
import { Flash } from "../components/flash";
import {
	UploadButton,
	UploadDialog,
	UploadEmptyState,
} from "../components/upload-dialog";
import { LIBRARY_PAGE_SIZE } from "../modules/library/service";
import { trackGroup, unused } from "../utils/misc";
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
	"upload-too-large":
		"Upload rejected: the file(s) are too large for the server to accept. If you're behind a reverse proxy, its upload size limit needs to be raised.",
	rename: "Couldn't rename track.",
};

function TrackCard({
	t,
	playCount,
	isAdmin,
}: {
	t: Track;
	playCount: number;
	isAdmin: boolean;
}) {
	return (
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
						width={110}
						height={110}
						loading="lazy"
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
				<details class="track-rename" onclick="event.stopPropagation()">
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
				<p class="text-xs font-medium truncate track-title">{t.title}</p>
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
			{playCount > 0 && (
				<p class="text-xs text-subtle tabular-nums">
					{playCount} play{playCount !== 1 ? "s" : ""}
				</p>
			)}
		</div>
	);
}

/**
 * Tracks (already ordered by group, see `LibraryService.listTracksPage`),
 * rendered with a group header inserted whenever the group changes —
 * including before the first item, so a fragment can be dropped into the
 * client-side infinite-scroll append without extra bookkeeping.
 */
export function TrackGroups({
	tracks,
	playCounts = new Map(),
	isAdmin,
}: {
	tracks: Track[];
	playCounts?: Map<number, number>;
	isAdmin: boolean;
}) {
	let lastGroup: string | null = null;
	return (
		<>
			{tracks.map((t) => {
				const group = trackGroup(t.title);
				const showHeader = group !== lastGroup;
				lastGroup = group;
				return (
					<>
						{showHeader && (
							<h2
								data-group={group}
								class="col-span-full text-xs font-semibold uppercase tracking-wider text-muted sticky top-0 bg-background/95 backdrop-blur-sm py-1.5 first:pt-0"
							>
								{group}
							</h2>
						)}
						<TrackCard
							t={t}
							playCount={playCounts.get(t.id) ?? 0}
							isAdmin={isAdmin}
						/>
					</>
				);
			})}
		</>
	);
}

function AnonymousStreamingAccess({ streamingKey }: { streamingKey: string }) {
	return (
		<details class="border border-border rounded-lg bg-surface/40 px-4 py-3">
			<summary class="text-sm font-medium cursor-pointer">
				Stream with a Subsonic app
			</summary>
			<div class="flex flex-col gap-3 mt-3">
				<p class="text-xs text-muted">
					Point any Subsonic or OpenSubsonic client (DSub, Substreamer,
					Symfonium, Feishin, Amperfy, ...) at this server with the username{" "}
					<span class="font-mono">anonymous</span> and the key below.
				</p>
				<div class="flex gap-2">
					<input
						id="anonymous-streaming-key"
						type="text"
						readonly
						value={streamingKey}
						class="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
					/>
					<button
						type="button"
						data-copy-key="anonymous-streaming-key"
						class="rounded-md border border-border text-sm font-medium px-4 py-2 text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer"
						title="Copy"
						aria-label="Copy"
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
							<rect x="9" y="9" width="13" height="13" rx="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
					</button>
				</div>
			</div>
		</details>
	);
}

export function LibraryPage({
	name,
	tracks,
	playCounts = new Map(),
	isAdmin,
	signedIn = true,
	anonymousStreamingKey,
	ok,
	error,
}: {
	name: string;
	tracks: Track[];
	playCounts?: Map<number, number>;
	isAdmin: boolean;
	signedIn?: boolean;
	anonymousStreamingKey?: string | null;
	ok?: string;
	error?: string;
}) {
	return (
		<Layout title="Library" active="library" signedIn={signedIn}>
			<main class="flex-1 flex flex-col p-4 sm:p-6 gap-6">
				<div class="flex items-center justify-between gap-4">
					<p class="text-sm text-muted">
						{signedIn ? (
							<>
								Welcome back,{" "}
								<span class="text-accent font-medium">{name}</span>
							</>
						) : (
							"Browsing as guest"
						)}
					</p>
					{isAdmin && tracks.length > 0 && <UploadButton />}
				</div>

				{!signedIn && anonymousStreamingKey && (
					<AnonymousStreamingAccess streamingKey={anonymousStreamingKey} />
				)}

				{isAdmin && <UploadDialog />}

				<Flash variant="ok" message={ok && (OK_MESSAGES[ok] ?? "Saved.")} />
				<Flash
					variant="error"
					message={error && (ERROR_MESSAGES[error] ?? "Something went wrong.")}
				/>

				{tracks.length === 0 ? (
					isAdmin ? (
						<UploadEmptyState />
					) : (
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
					)
				) : (
					<div
						id="library-grid"
						class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3"
					>
						<TrackGroups
							tracks={tracks}
							playCounts={playCounts}
							isAdmin={isAdmin}
						/>
					</div>
				)}

				{tracks.length >= LIBRARY_PAGE_SIZE && (
					<div id="library-sentinel" data-offset={String(LIBRARY_PAGE_SIZE)} />
				)}
			</main>
		</Layout>
	);
}
