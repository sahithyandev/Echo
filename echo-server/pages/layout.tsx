import { Html } from "@elysiajs/html";
import { AlbumArt } from "../components/album-art";
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
				<meta name="theme-color" content="#0c0a09" />
				<link rel="preconnect" href="https://api.fontshare.com" />
				<link
					href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap"
					rel="stylesheet"
				/>
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
					class="hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-background/85 border-t border-border/40 z-50"
				>
					<div class="flex items-center gap-6 px-6 py-3">
						<div class="flex items-center gap-3 w-56 shrink-0 min-w-0">
							<img
								id="player-art"
								class="hidden rounded-sm shrink-0 object-cover w-10 h-10"
								alt="Album art"
							/>
							<div id="player-art-placeholder">
								<AlbumArt size={40} />
							</div>
							<div class="min-w-0">
								<div
									id="player-title"
									class="text-sm font-medium truncate leading-snug"
								/>
								<div
									id="player-artist"
									class="text-xs text-muted truncate leading-snug"
								/>
							</div>
						</div>

						<div class="flex-1 flex items-center gap-3 min-w-0">
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
								step="any"
								value="0"
								class="seek-bar flex-1"
							/>
							<span
								id="player-duration"
								class="text-xs text-muted tabular-nums shrink-0"
							>
								0:00
							</span>
						</div>

						<div class="flex items-center gap-2 shrink-0">
							<button
								id="player-prev"
								type="button"
								class="w-7 h-7 flex items-center justify-center text-muted hover:text-accent transition-colors cursor-pointer"
								aria-label="Previous"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="currentColor"
									role="img"
									aria-label="Previous"
								>
									<rect x="4" y="4" width="2" height="16" />
									<polygon points="19,4 7,12 19,20" />
								</svg>
							</button>
							<button
								id="player-play"
								type="button"
								class="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity cursor-pointer shadow-[0_0_16px_-2px_var(--color-accent)]"
							>
								<svg
									id="icon-play"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="currentColor"
									aria-label="Play"
								>
									<polygon points="6,3 20,12 6,21" />
								</svg>
								<svg
									id="icon-pause"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="currentColor"
									aria-label="Pause"
									class="hidden"
								>
									<rect x="6" y="4" width="4" height="16" />
									<rect x="14" y="4" width="4" height="16" />
								</svg>
							</button>
							<button
								id="player-next"
								type="button"
								class="w-7 h-7 flex items-center justify-center text-muted hover:text-accent transition-colors cursor-pointer"
								aria-label="Next"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="currentColor"
									role="img"
									aria-label="Next"
								>
									<polygon points="5,4 17,12 5,20" />
									<rect x="18" y="4" width="2" height="16" />
								</svg>
							</button>
						</div>
					</div>
				</div>
				<audio id="echo-audio" preload="none" />
				<script src="/player.js" defer />
			</body>
		</html>
	);
}
