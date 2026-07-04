type ParsedPreview = {
	title: string;
	artist: string;
	art: string | null;
};

let previewUrls: string[] = [];

function clearPreviewUrls(): void {
	for (const url of previewUrls) URL.revokeObjectURL(url);
	previewUrls = [];
}

function escapeHtml(s: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

async function extractPreview(file: File): Promise<ParsedPreview> {
	try {
		// Loaded from a runtime URL, not resolvable by tsc's module resolution.
		// @ts-expect-error
		const { parseBlob, selectCover } = await import("/upload-metadata.js");
		const meta = await parseBlob(file, { skipPostHeaders: true });
		const cover = selectCover(meta.common.picture);
		const art = cover
			? URL.createObjectURL(
					new Blob([new Uint8Array(cover.data)], { type: cover.format }),
				)
			: null;
		return {
			title: meta.common.title || file.name,
			artist:
				meta.common.artist ||
				meta.common.artists?.join(", ") ||
				"Unknown artist",
			art,
		};
	} catch {
		return { title: file.name, artist: "Unknown artist", art: null };
	}
}

function rowHtml(p: ParsedPreview): string {
	const art = p.art
		? `<img src="${p.art}" class="w-8 h-8 rounded object-cover shrink-0" alt="" />`
		: `<div class="w-8 h-8 rounded bg-background shrink-0"></div>`;
	return `<div class="flex items-center gap-2 text-left">
		${art}
		<div class="min-w-0">
			<p class="text-xs font-medium truncate">${escapeHtml(p.title)}</p>
			<p class="text-[11px] text-muted truncate">${escapeHtml(p.artist)}</p>
		</div>
	</div>`;
}

async function renderFileList(): Promise<void> {
	const input = document.getElementById(
		"upload-files",
	) as HTMLInputElement | null;
	const list = document.getElementById("upload-file-list");
	if (!input || !list) return;

	clearPreviewUrls();
	const files = Array.from(input.files ?? []);
	if (!files.length) {
		list.innerHTML = "";
		return;
	}

	list.innerHTML = `<p class="text-xs text-muted">Reading tags...</p>`;
	const previews = await Promise.all(files.map(extractPreview));
	for (const p of previews) if (p.art) previewUrls.push(p.art);
	list.innerHTML = previews.map(rowHtml).join("");
}

function closeDialog(): void {
	(document.getElementById("upload-form") as HTMLFormElement | null)?.reset();
	clearPreviewUrls();
	const list = document.getElementById("upload-file-list");
	if (list) list.innerHTML = "";
	(
		document.getElementById("upload-dialog") as HTMLDialogElement | null
	)?.close();
}

document.addEventListener("click", (e) => {
	if (!(e.target instanceof Element)) return;

	if (e.target.closest("#upload-open")) {
		(
			document.getElementById("upload-dialog") as HTMLDialogElement | null
		)?.showModal();
		return;
	}

	if (e.target.closest("#upload-close, #upload-cancel")) {
		closeDialog();
		return;
	}

	if (e.target.id === "upload-dialog") {
		(e.target as HTMLDialogElement).close();
	}
});

document.addEventListener("change", (e) => {
	if (e.target instanceof Element && e.target.id === "upload-files") {
		renderFileList();
	}
});

const dropzoneActiveClasses = ["border-accent", "bg-accent/5"];

for (const ev of ["dragenter", "dragover", "dragleave", "dragend", "drop"]) {
	document.addEventListener(ev, (e) => {
		if (!(e.target instanceof Element)) return;
		const zone = e.target.closest("#upload-dropzone");
		if (!zone) return;
		e.preventDefault();
		if (ev === "dragenter" || ev === "dragover") {
			zone.classList.add(...dropzoneActiveClasses);
		} else {
			zone.classList.remove(...dropzoneActiveClasses);
		}
		if (ev === "drop") {
			const dt = (e as DragEvent).dataTransfer;
			const input = document.getElementById(
				"upload-files",
			) as HTMLInputElement | null;
			if (dt?.files && input) {
				input.files = dt.files;
				renderFileList();
			}
		}
	});
}
