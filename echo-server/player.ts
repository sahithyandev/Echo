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
	document.body.style.paddingBottom = "4.5rem";
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

audio.addEventListener("play", () => {
	iconPlay.classList.add("hidden");
	iconPause.classList.remove("hidden");
});
audio.addEventListener("pause", () => {
	iconPlay.classList.remove("hidden");
	iconPause.classList.add("hidden");
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
	if (audio.duration && !Number.isNaN(audio.duration)) {
		currentTimeEl.textContent = fmt(
			(Number(seekBar.value) / 100) * audio.duration,
		);
	}
});

audio.addEventListener("timeupdate", () => {
	if (seeking || !audio.duration || Number.isNaN(audio.duration)) return;
	seekBar.value = String((audio.currentTime / audio.duration) * 100);
	currentTimeEl.textContent = fmt(audio.currentTime);
});

audio.addEventListener("durationchange", () => {
	if (!Number.isNaN(audio.duration)) {
		durationEl.textContent = fmt(audio.duration);
	}
});
