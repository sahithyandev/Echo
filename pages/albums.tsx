import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type Album = {
	id: number;
	title: string;
	cover_path: string | null;
	artists: string[];
};

export function AlbumsPage({ albums }: { albums: Album[] }) {
	return (
		<Layout title="Echo — Albums" active="albums">
			<main class="flex-1 flex flex-col p-6 gap-6">
				{albums.length === 0 ? (
					<div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
						<p class="text-sm text-muted">No albums yet.</p>
					</div>
				) : (
					<div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
						{albums.map((a) => (
							<a href={`/album/${a.id}`} class="group">
								<div class="relative aspect-square overflow-hidden rounded-md bg-surface mb-2">
									{a.cover_path ? (
										<img
											src={a.cover_path}
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
								<p class="text-xs font-medium truncate">{a.title}</p>
								<p class="text-xs text-muted truncate">
									{a.artists.join(", ") || "—"}
								</p>
							</a>
						))}
					</div>
				)}
			</main>
		</Layout>
	);
}
