import { Html } from "@elysiajs/html";
import { formatHours, unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type ByArtist = { artist_id: number; artist_name: string; seconds: number };
type ByAlbum = {
	album_id: number;
	album_title: string;
	cover_path: string | null;
	seconds: number;
};
type ByYear = { year: number | null; seconds: number };
type ByDay = { day: string; seconds: number };

function BarChart({ rows }: { rows: ByDay[] }) {
	const max = Math.max(...rows.map((r) => r.seconds), 1);
	// Skip labels on some bars so they don't overlap when there are many days.
	const labelEvery = Math.max(Math.ceil(rows.length / 10), 1);
	return (
		<div>
			<h2 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
				Playtime by date
			</h2>
			{rows.length === 0 ? (
				<p class="text-sm text-subtle">No listening data yet.</p>
			) : (
				<div class="flex text-xs text-subtle">
					<div class="flex flex-col justify-between h-40 pr-2 text-right tabular-nums shrink-0">
						<span>{formatHours(max)}</span>
						<span>0m</span>
					</div>
					<div class="flex-1 flex items-end gap-1 h-40 border-l border-b border-border/50 pl-2">
						{rows.map((r) => (
							<div class="flex-1 max-w-25 h-full flex flex-col justify-end items-center group">
								<span class="mb-1 text-[10px] tabular-nums opacity-0 group-hover:opacity-100">
									{formatHours(r.seconds)}
								</span>
								<div
									class="w-full bg-accent/70 rounded-t group-hover:bg-accent transition-colors"
									style={`height: ${Math.max((r.seconds / max) * 100, 2)}%`}
									title={`${r.day} — ${formatHours(r.seconds)}`}
								/>
							</div>
						))}
					</div>
				</div>
			)}
			{rows.length > 0 && (
				<div class="flex ml-10 mt-1 text-[10px] text-subtle">
					{rows.map((r, i) => (
						<div class="flex-1 max-w-25 text-center truncate">
							{i % labelEvery === 0 ? r.day : ""}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function AlbumGallery({ rows }: { rows: ByAlbum[] }) {
	return (
		<div>
			<h2 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
				By album
			</h2>
			{rows.length === 0 ? (
				<p class="text-sm text-subtle">No listening data yet.</p>
			) : (
				<div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
					{rows.map((r) => (
						<div>
							<div class="aspect-square overflow-hidden rounded-md bg-surface mb-2">
								{r.cover_path ? (
									<img
										src={r.cover_path}
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
							</div>
							<p class="text-xs font-medium truncate">{r.album_title}</p>
							<p class="text-xs text-subtle tabular-nums">
								{formatHours(r.seconds)}
							</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function Section({
	title,
	rows,
}: {
	title: string;
	rows: { label: string; seconds: number }[];
}) {
	return (
		<div>
			<h2 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
				{title}
			</h2>
			{rows.length === 0 ? (
				<p class="text-sm text-subtle">No listening data yet.</p>
			) : (
				<table class="w-full text-sm border-collapse">
					<tbody>
						{rows.map((r) => (
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 font-medium">{r.label}</td>
								<td class="py-2 text-muted text-right tabular-nums">
									{formatHours(r.seconds)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}

export function AnalyticsPage({
	totalSeconds,
	byArtist,
	byAlbum,
	byYear,
	byDay,
}: {
	totalSeconds: number;
	byArtist: ByArtist[];
	byAlbum: ByAlbum[];
	byYear: ByYear[];
	byDay: ByDay[];
}) {
	return (
		<Layout title="Echo — Analytics" active="analytics">
			<main class="flex-1 flex flex-col p-4 sm:p-6 gap-8">
				<div>
					<p class="text-xs text-accent font-medium uppercase tracking-wide mb-0.5">
						Analytics
					</p>
					<h1 class="text-2xl font-bold tracking-tight font-display">
						{formatHours(totalSeconds)} played
					</h1>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 w-full gap-8">
					<BarChart rows={byDay} />

					<AlbumGallery
						rows={byAlbum.filter((r) => r.seconds > 0).slice(0, 10)}
					/>

					<Section
						title="By artist"
						rows={byArtist
							.filter((r) => r.seconds > 0)
							.slice(0, 10)
							.map((r) => ({ label: r.artist_name, seconds: r.seconds }))}
					/>

					<Section
						title="By year"
						rows={byYear
							.filter((r) => r.year !== null && r.seconds > 0)
							.slice(0, 10)
							.map((r) => ({ label: String(r.year), seconds: r.seconds }))}
					/>
				</div>
			</main>
		</Layout>
	);
}
