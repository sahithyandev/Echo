const input = document.getElementById("search-input") as HTMLInputElement;
const panel = document.getElementById("search-panel") as HTMLDivElement;

let debounceId = 0;

function hide(): void {
	panel.classList.add("hidden");
	panel.innerHTML = "";
}

async function runSearch(q: string): Promise<void> {
	const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
	if (!res.ok) return;
	panel.innerHTML = await res.text();
	panel.classList.remove("hidden");
}

input.addEventListener("input", () => {
	const q = input.value.trim();
	clearTimeout(debounceId);
	if (!q) {
		hide();
		return;
	}
	debounceId = window.setTimeout(() => runSearch(q), 200);
});

input.addEventListener("keydown", (e) => {
	if (e.key === "Escape") hide();
});

document.addEventListener("click", (e) => {
	if (!(e.target instanceof Node)) return;
	if (input.contains(e.target) || panel.contains(e.target)) return;
	hide();
});
