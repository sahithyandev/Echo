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
