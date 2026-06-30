const audio = document.getElementById("echo-audio") as HTMLAudioElement;
const bar = document.getElementById("player-bar") as HTMLDivElement;
const titleEl = document.getElementById("player-title") as HTMLSpanElement;
const artistEl = document.getElementById("player-artist") as HTMLSpanElement;
const playBtn = document.getElementById("player-play") as HTMLButtonElement;
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

function playTrack(id: string, title: string, artist: string): void {
	if (audio.dataset.trackId !== id) {
		audio.src = `/track/${id}/stream`;
		audio.dataset.trackId = id;
	}
	audio.play();
	titleEl.textContent = title;
	artistEl.textContent = artist;
	bar.classList.remove("hidden");
	document.body.style.paddingBottom = "5.5rem";
	for (const row of document.querySelectorAll<HTMLTableRowElement>(
		"tr[data-track-id]",
	)) {
		row.classList.toggle("playing", row.dataset.trackId === id);
	}
}

document.addEventListener("click", (e) => {
	const row = (e.target as Element).closest<HTMLTableRowElement>(
		"tr[data-track-id]",
	);
	if (!row) return;
	const { trackId, title = "Unknown", artist = "" } = row.dataset;
	if (trackId) playTrack(trackId, title, artist);
});

playBtn.addEventListener("click", () => {
	if (audio.paused) audio.play();
	else audio.pause();
});

let rafId = 0;

function tick() {
	if (!seeking && audio.duration && !Number.isNaN(audio.duration)) {
		const pct = (audio.currentTime / audio.duration) * 100;
		seekBar.value = String(pct);
		seekBar.style.setProperty("--progress", `${pct}%`);
		currentTimeEl.textContent = fmt(audio.currentTime);
	}
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
