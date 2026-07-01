import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";

unused(Html);

type Tab = "library" | "albums" | "artists";

const tabs: { tab: Tab; href: string; label: string }[] = [
	{ tab: "library", href: "/library", label: "Library" },
	{ tab: "albums", href: "/albums", label: "Albums" },
	{ tab: "artists", href: "/artists", label: "Artists" },
];

export function Nav({ active }: { active: Tab }) {
	return (
		<header class="flex items-center justify-between px-6 py-4 border-b border-border">
			<div class="flex items-center gap-6">
				<a
					href="/library"
					class="wordmark-gradient text-xl font-bold font-display"
				>
					Echo
				</a>
				<nav class="flex items-center gap-4">
					{tabs.map((t) => (
						<a
							href={t.href}
							class={`text-sm font-medium transition-colors ${
								t.tab === active
									? "text-foreground"
									: "text-muted hover:text-foreground"
							}`}
						>
							{t.label}
						</a>
					))}
				</nav>
			</div>
			<div class="relative w-96">
				<input
					id="search-input"
					type="text"
					placeholder="Search artists, albums, tracks"
					autocomplete="off"
					class="w-full text-sm bg-surface border border-border rounded-md px-3 py-1.5 placeholder:text-subtle focus:outline-none focus:border-accent transition-colors"
				/>
				<div
					id="search-panel"
					class="hidden absolute right-0 top-[calc(100%+0.5rem)] w-full max-h-[70vh] overflow-y-auto bg-background border border-border rounded-md shadow-lg z-50"
				/>
			</div>
			<form method="post" action="/auth/sign-out">
				<button
					type="submit"
					class="text-xs text-muted hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors hover:bg-surface cursor-pointer"
				>
					Sign out
				</button>
			</form>
		</header>
	);
}
