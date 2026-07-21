import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { siteName } from "../utils/site-name";

unused(Html);

export type Tab =
	| "home"
	| "library"
	| "albums"
	| "artists"
	| "analytics"
	| "settings";

const icons: Record<Tab, JSX.Element> = {
	home: (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M3 11.5 12 4l9 7.5" />
			<path d="M5 10v10h14V10" />
		</svg>
	),
	library: (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<line x1="4" y1="6" x2="20" y2="6" />
			<line x1="4" y1="12" x2="20" y2="12" />
			<line x1="4" y1="18" x2="14" y2="18" />
		</svg>
	),
	albums: (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="2.5" />
		</svg>
	),
	artists: (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="8" r="3.5" />
			<path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
		</svg>
	),
	analytics: (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<line x1="5" y1="20" x2="5" y2="12" />
			<line x1="12" y1="20" x2="12" y2="6" />
			<line x1="19" y1="20" x2="19" y2="15" />
		</svg>
	),
	settings: (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
		</svg>
	),
};

const tabs: { tab: Tab; href: string; label: string }[] = [
	{ tab: "home", href: "/", label: "Home" },
	{ tab: "library", href: "/library", label: "Library" },
	{ tab: "albums", href: "/albums", label: "Albums" },
	{ tab: "artists", href: "/artists", label: "Artists" },
	{ tab: "analytics", href: "/analytics", label: "Analytics" },
	{ tab: "settings", href: "/settings", label: "Settings" },
];

export function Nav({
	active,
	signedIn = true,
}: {
	active: Tab;
	signedIn?: boolean;
}) {
	const visibleTabs = signedIn
		? tabs
		: tabs.filter(
				(t) =>
					t.tab !== "home" && t.tab !== "analytics" && t.tab !== "settings",
			);
	return (
		<header class="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
			<div class="flex items-center gap-6">
				<a href="/" class="wordmark-gradient text-xl font-bold font-display">
					{siteName}
				</a>
				<nav class="hidden md:flex items-center gap-4">
					{visibleTabs.map((t) => (
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
			<div class="relative flex-1 min-w-0 mx-3 md:mx-4 max-w-96">
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
			{signedIn ? (
				<form method="post" action="/auth/sign-out">
					<button
						type="submit"
						class="text-xs text-muted hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors hover:bg-surface cursor-pointer"
					>
						Sign out
					</button>
				</form>
			) : (
				<a
					href="/auth/login"
					class="text-xs text-muted hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors hover:bg-surface"
				>
					Sign in
				</a>
			)}
			<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background/95 backdrop-blur-xl">
				{visibleTabs.map((t) => (
					<a
						href={t.href}
						class={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
							t.tab === active
								? "text-foreground"
								: "text-muted hover:text-foreground"
						}`}
					>
						{icons[t.tab]}
						{t.label}
					</a>
				))}
			</nav>
		</header>
	);
}
