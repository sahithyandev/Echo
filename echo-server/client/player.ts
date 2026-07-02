const audio = document.getElementById("echo-audio") as HTMLAudioElement;
const bar = document.getElementById("player-bar") as HTMLDivElement;
const titleEl = document.getElementById("player-title") as HTMLSpanElement;
const artistEl = document.getElementById("player-artist") as HTMLSpanElement;
const artImg = document.getElementById("player-art") as HTMLImageElement;
const artPlaceholder = document.getElementById(
	"player-art-placeholder",
) as HTMLElement;
const playBtn = document.getElementById("player-play") as HTMLButtonElement;
const prevBtn = document.getElementById("player-prev") as HTMLButtonElement;
const nextBtn = document.getElementById("player-next") as HTMLButtonElement;
const shuffleBtn = document.getElementById(
	"player-shuffle",
) as HTMLButtonElement;
const repeatBtn = document.getElementById("player-repeat") as HTMLButtonElement;
const repeatOneBadge = document.getElementById(
	"player-repeat-one",
) as HTMLSpanElement;
const iconPlay = document.getElementById("icon-play") as Element;
const iconPause = document.getElementById("icon-pause") as Element;
const seekBar = document.getElementById("player-seek") as HTMLInputElement;
const currentTimeEl = document.getElementById(
	"player-current",
) as HTMLSpanElement;
const durationEl = document.getElementById(
	"player-duration",
) as HTMLSpanElement;

function fmt(s: number): string {
	const m = Math.floor(s / 60);
	return `${m}:${Math.floor(s % 60)
		.toString()
		.padStart(2, "0")}`;
}

let seeking = false;
let currentIndex = -1;

type RepeatMode = "off" | "all" | "one";
let shuffle = false;
let repeatMode: RepeatMode = "off";

function setActive(btn: HTMLButtonElement, active: boolean): void {
	btn.classList.toggle("text-accent", active);
	btn.classList.toggle("bg-accent/10", active);
	btn.setAttribute("aria-pressed", String(active));
}

function renderPlaybackModes(): void {
	setActive(shuffleBtn, shuffle);
	setActive(repeatBtn, repeatMode !== "off");
	repeatOneBadge.classList.toggle("hidden", repeatMode !== "one");
}

async function loadPlaybackModes(): Promise<void> {
	try {
		const res = await fetch("/settings");
		if (!res.ok) return;
		const data = await res.json();
		shuffle = Boolean(data.shuffle);
		repeatMode = data.repeat_mode;
		renderPlaybackModes();
		if (data.playback_track_id) {
			restorePlayback(
				data.playback_track_id,
				data.playback_position_seconds ?? 0,
				Boolean(data.playback_playing),
			);
		}
	} catch {
		// keep defaults if settings can't be loaded
	}
}

function savePlaybackModes(): void {
	fetch("/settings", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ shuffle, repeat_mode: repeatMode }),
	});
}

function savePlaybackPosition(): void {
	const trackId = audio.dataset.trackId;
	fetch("/settings/playback", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			track_id: trackId ? Number(trackId) : null,
			position_seconds: trackId ? Math.floor(audio.currentTime) : null,
			playing: trackId ? !audio.paused : false,
		}),
	});
}

let listenTrackId: string | null = null;
let listenAnchor = 0;
let listenAccrued = 0;

function sendHeartbeat(
	trackId: string,
	seconds: number,
	beacon: boolean,
): void {
	const body = JSON.stringify({ track_id: Number(trackId), seconds });
	if (beacon && navigator.sendBeacon) {
		navigator.sendBeacon(
			"/playback/heartbeat",
			new Blob([body], { type: "application/json" }),
		);
		return;
	}
	fetch("/playback/heartbeat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
	});
}

/** Report accrued listening time for the current track, then reset the accrual. */
function flushListening(beacon = false): void {
	if (listenAccrued <= 0 || !listenTrackId) return;
	sendHeartbeat(listenTrackId, listenAccrued, beacon);
	listenAccrued = 0;
}

function resetListenTracking(trackId: string): void {
	flushListening();
	listenTrackId = trackId;
	listenAnchor = 0;
	listenAccrued = 0;
}

function resumeOnNextInteraction(): void {
	const resume = () => audio.play();
	document.addEventListener("pointerdown", resume, { once: true });
	document.addEventListener("keydown", resume, { once: true });
}

function showRestoredTrack(
	trackId: number,
	title: string,
	artist: string,
	art: string,
	positionSeconds: number,
	playing: boolean,
): void {
	audio.src = `/track/${trackId}/stream`;
	audio.dataset.trackId = String(trackId);
	resetListenTracking(String(trackId));
	audio.addEventListener(
		"loadedmetadata",
		() => {
			audio.currentTime = positionSeconds;
			renderProgress();
			if (playing) audio.play().catch(() => resumeOnNextInteraction());
		},
		{ once: true },
	);
	// preload="none" won't fetch metadata just from setting src; force it.
	audio.load();
	titleEl.textContent = title;
	artistEl.textContent = artist;
	if (art) {
		artImg.src = art;
		artImg.classList.remove("hidden");
		artPlaceholder.classList.add("hidden");
	} else {
		artImg.classList.add("hidden");
		artPlaceholder.classList.remove("hidden");
	}
	bar.classList.remove("hidden");
	document.body.style.paddingBottom = "5.5rem";
	currentIndex = playlist().findIndex(
		(r) => r.dataset.trackId === String(trackId),
	);
}

async function restorePlayback(
	trackId: number,
	positionSeconds: number,
	playing: boolean,
): Promise<void> {
	const row = playlist().find((r) => r.dataset.trackId === String(trackId));
	if (row) {
		const { title = "Unknown", artist = "", art = "" } = row.dataset;
		showRestoredTrack(trackId, title, artist, art, positionSeconds, playing);
		row.classList.add("playing");
		return;
	}
	// Track isn't on this page (e.g. an album/artist page not containing it) — fetch its metadata.
	try {
		const res = await fetch(`/track/${trackId}`);
		if (!res.ok) return;
		const track = await res.json();
		showRestoredTrack(
			trackId,
			track.title ?? "Unknown",
			track.artists?.map((a: { name: string }) => a.name).join(", ") ?? "",
			track.album?.cover_path ?? "",
			positionSeconds,
			playing,
		);
	} catch {
		// keep player hidden if metadata can't be loaded
	}
}

loadPlaybackModes();

shuffleBtn.addEventListener("click", () => {
	shuffle = !shuffle;
	renderPlaybackModes();
	savePlaybackModes();
});

repeatBtn.addEventListener("click", () => {
	const order: RepeatMode[] = ["off", "all", "one"];
	repeatMode = order[(order.indexOf(repeatMode) + 1) % order.length];
	renderPlaybackModes();
	savePlaybackModes();
});

function playlist(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>("[data-track-id]"));
}

/** Index of the track to advance to, or -1 if playback should stop. */
function nextIndex(els: HTMLElement[]): number {
	if (!els.length) return -1;
	if (shuffle) {
		if (els.length === 1) return 0;
		let idx = currentIndex;
		while (idx === currentIndex) idx = Math.floor(Math.random() * els.length);
		return idx;
	}
	if (currentIndex >= els.length - 1) return repeatMode === "off" ? -1 : 0;
	return currentIndex + 1;
}

function playTrack(
	id: string,
	title: string,
	artist: string,
	art: string,
): void {
	if (audio.dataset.trackId !== id) {
		audio.src = `/track/${id}/stream`;
		audio.dataset.trackId = id;
		resetListenTracking(id);
		fetch("/history", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ track_id: Number(id) }),
		});
	}
	audio.play();
	titleEl.textContent = title;
	artistEl.textContent = artist;
	if (art) {
		artImg.src = art;
		artImg.classList.remove("hidden");
		artPlaceholder.classList.add("hidden");
	} else {
		artImg.classList.add("hidden");
		artPlaceholder.classList.remove("hidden");
	}
	bar.classList.remove("hidden");
	document.body.style.paddingBottom = "5.5rem";
	const rows = playlist();
	currentIndex = rows.findIndex((r) => r.dataset.trackId === id);
	for (const row of rows) {
		row.classList.toggle("playing", row.dataset.trackId === id);
	}
}

function playRow(el: HTMLElement): void {
	const { trackId, title = "Unknown", artist = "", art = "" } = el.dataset;
	if (trackId) playTrack(trackId, title, artist, art);
}

document.addEventListener("click", (e) => {
	const target = e.target as Element;
	if (target.closest("a")) return;
	const el = target.closest<HTMLElement>("[data-track-id]");
	if (!el) return;
	playRow(el);
});

playBtn.addEventListener("click", () => {
	if (audio.paused) audio.play();
	else audio.pause();
});

prevBtn.addEventListener("click", () => {
	const els = playlist();
	if (!els.length) return;
	if (audio.currentTime > 3) {
		audio.currentTime = 0;
		return;
	}
	const idx = currentIndex <= 0 ? els.length - 1 : currentIndex - 1;
	playRow(els[idx]);
});

nextBtn.addEventListener("click", () => {
	const els = playlist();
	if (!els.length) return;
	// Manual "next" always advances (wraps at the end) regardless of repeat mode.
	const idx = shuffle
		? nextIndex(els)
		: currentIndex >= els.length - 1
			? 0
			: currentIndex + 1;
	playRow(els[idx]);
});

audio.addEventListener("ended", () => {
	if (repeatMode === "one") {
		audio.currentTime = 0;
		audio.play();
		return;
	}
	const els = playlist();
	const idx = nextIndex(els);
	if (idx >= 0) playRow(els[idx]);
});

let rafId = 0;

function renderProgress(): void {
	if (!audio.duration || Number.isNaN(audio.duration)) return;
	const pct = (audio.currentTime / audio.duration) * 100;
	seekBar.value = String(pct);
	seekBar.style.setProperty("--progress", `${pct}%`);
	currentTimeEl.textContent = fmt(audio.currentTime);
}

function tick() {
	if (!seeking) renderProgress();
	rafId = requestAnimationFrame(tick);
}

audio.addEventListener("play", () => {
	iconPlay.classList.add("hidden");
	iconPause.classList.remove("hidden");
	rafId = requestAnimationFrame(tick);
});
audio.addEventListener("pause", () => {
	iconPlay.classList.remove("hidden");
	iconPause.classList.add("hidden");
	cancelAnimationFrame(rafId);
	savePlaybackPosition();
	flushListening();
});

let lastSavedAt = 0;
audio.addEventListener("timeupdate", () => {
	// Accrue only real forward playback: seeks produce large jumps, pauses produce 0 delta.
	const delta = audio.currentTime - listenAnchor;
	listenAnchor = audio.currentTime;
	if (!audio.paused && delta > 0 && delta < 1.5) {
		listenAccrued += delta;
		if (listenAccrued >= 7.5) flushListening();
	}

	if (audio.currentTime - lastSavedAt < 5) return;
	lastSavedAt = audio.currentTime;
	savePlaybackPosition();
});

audio.addEventListener("ended", () => flushListening());

window.addEventListener("beforeunload", () => {
	savePlaybackPosition();
	flushListening(true);
});

seekBar.addEventListener("mousedown", () => {
	seeking = true;
});
seekBar.addEventListener("mouseup", () => {
	seeking = false;
	if (audio.duration && !Number.isNaN(audio.duration)) {
		audio.currentTime = (Number(seekBar.value) / 100) * audio.duration;
	}
});
seekBar.addEventListener("input", () => {
	seekBar.style.setProperty("--progress", `${seekBar.value}%`);
	if (audio.duration && !Number.isNaN(audio.duration)) {
		currentTimeEl.textContent = fmt(
			(Number(seekBar.value) / 100) * audio.duration,
		);
	}
});

audio.addEventListener("durationchange", () => {
	if (!Number.isNaN(audio.duration)) {
		durationEl.textContent = fmt(audio.duration);
	}
});
