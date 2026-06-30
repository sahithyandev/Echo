import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";

unused(Html);

export function Layout({
	title,
	children,
}: {
	title: string;
	children: JSX.Element | JSX.Element[];
}) {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title}</title>
				<link rel="stylesheet" href="/global.css" />
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/favicon-16x16.png"
				/>
			</head>
			<body class="bg-background text-foreground font-sans antialiased">
				{children}
				<div
					id="player-bar"
					class="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-3 flex items-center gap-4 z-50"
				>
					<div class="flex flex-col min-w-0 w-40 shrink-0">
						<span id="player-title" class="text-sm font-medium truncate" />
						<span id="player-artist" class="text-xs text-muted truncate" />
					</div>
					<button
						id="player-play"
						type="button"
						class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface transition-colors cursor-pointer"
					>
						<svg
							id="icon-play"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-label="Play"
						>
							<polygon points="5,3 19,12 5,21" />
						</svg>
						<svg
							id="icon-pause"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-label="Pause"
							class="hidden"
						>
							<rect x="6" y="4" width="4" height="16" />
							<rect x="14" y="4" width="4" height="16" />
						</svg>
					</button>
					<span
						id="player-current"
						class="text-xs text-muted tabular-nums shrink-0"
					>
						0:00
					</span>
					<input
						id="player-seek"
						type="range"
						min="0"
						max="100"
						value="0"
						class="flex-1 accent-foreground"
					/>
					<span
						id="player-duration"
						class="text-xs text-muted tabular-nums shrink-0"
					>
						0:00
					</span>
				</div>
				<audio id="echo-audio" preload="none" />
				<script src="/player.js" defer />
			</body>
		</html>
	);
}
