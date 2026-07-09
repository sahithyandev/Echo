let loading = false;
let observer: IntersectionObserver | null = null;

function observeSentinel(sentinel: HTMLElement): void {
	observer?.disconnect();
	observer = new IntersectionObserver((entries) => {
		if (entries.some((e) => e.isIntersecting)) loadMore(sentinel);
	});
	observer.observe(sentinel);
}

async function loadMore(sentinel: HTMLElement): Promise<void> {
	if (loading) return;
	loading = true;
	try {
		const offset = sentinel.dataset.offset ?? "0";
		const res = await fetch(`/library/tracks?offset=${offset}`);
		if (!res.ok) return;
		const html = await res.text();

		const frag = document.createElement("div");
		frag.innerHTML = html;
		const newSentinel = frag.querySelector<HTMLElement>("#library-sentinel");
		newSentinel?.remove();

		const grid = document.getElementById("library-grid");
		if (!grid) return;

		const lastHeader = grid.querySelector<HTMLElement>(
			"[data-group]:last-of-type",
		);
		const firstNew = frag.firstElementChild;
		if (
			lastHeader &&
			firstNew instanceof HTMLElement &&
			firstNew.tagName === "H2" &&
			firstNew.dataset.group === lastHeader.dataset.group
		) {
			firstNew.remove();
		}

		while (frag.firstChild) grid.appendChild(frag.firstChild);

		sentinel.replaceWith(...(newSentinel ? [newSentinel] : []));
		if (newSentinel) observeSentinel(newSentinel);
	} finally {
		loading = false;
	}
}

function init(): void {
	const sentinel = document.getElementById("library-sentinel");
	if (sentinel) observeSentinel(sentinel);
	else observer?.disconnect();
}

init();
document.addEventListener("page:loaded", init);
