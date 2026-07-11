import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type Artist = { id: number; name: string };

function groupByLetter(artists: Artist[]): [string, Artist[]][] {
	const groups = new Map<string, Artist[]>();
	for (const artist of artists) {
		const letter = /[A-Za-z]/.test(artist.name[0] ?? "")
			? artist.name[0].toUpperCase()
			: "#";
		const group = groups.get(letter);
		if (group) group.push(artist);
		else groups.set(letter, [artist]);
	}
	return Array.from(groups.entries());
}

export function ArtistsPage({ artists }: { artists: Artist[] }) {
	const groups = groupByLetter(artists);
	return (
		<Layout title="Echo — Artists" active="artists">
			<main class="flex-1 flex flex-col p-4 sm:p-6 gap-8">
				{artists.length === 0 ? (
					<div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
						<p class="text-sm text-muted">No artists yet.</p>
					</div>
				) : (
					<div class="flex flex-col gap-8">
						{groups.map(([letter, group]) => (
							<section>
								<h2 class="text-2xl font-display font-bold text-accent mb-2">
									{letter}
								</h2>
								<div class="border-t border-border">
									{group.map((a) => (
										<a
											href={`/artist/${a.id}`}
											class="flex items-center px-1 py-3 border-b border-border/50 hover:bg-surface/40 transition-colors"
										>
											<span class="text-lg font-medium truncate">{a.name}</span>
										</a>
									))}
								</div>
							</section>
						))}
					</div>
				)}
			</main>
		</Layout>
	);
}
