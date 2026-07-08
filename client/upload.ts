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
	const progress = document.getElementById("upload-progress");
	progress?.classList.add("hidden");
	progress?.classList.remove("flex");
	(
		document.getElementById("upload-dialog") as HTMLDialogElement | null
	)?.close();
}

const BATCH_BYTES_LIMIT = 20 * 1024 * 1024;

function batchFiles(files: File[]): File[][] {
	const batches: File[][] = [];
	let current: File[] = [];
	let currentBytes = 0;
	for (const file of files) {
		if (current.length > 0 && currentBytes + file.size > BATCH_BYTES_LIMIT) {
			batches.push(current);
			current = [];
			currentBytes = 0;
		}
		current.push(file);
		currentBytes += file.size;
	}
	if (current.length > 0) batches.push(current);
	return batches;
}

function uploadBatch(batch: File[]): Promise<number> {
	return new Promise((resolve, reject) => {
		const formData = new FormData();
		for (const file of batch) formData.append("files", file);

		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/library/upload");
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onBatchProgress?.(e.loaded);
		};
		xhr.onload = () => {
			if (xhr.status < 200 || xhr.status >= 300) {
				reject(new Error(`Upload failed: ${xhr.status}`));
				return;
			}
			try {
				const body = JSON.parse(xhr.responseText) as { uploaded: number };
				resolve(body.uploaded);
			} catch {
				reject(new Error("Invalid upload response"));
			}
		};
		xhr.onerror = () => reject(new Error("Upload failed"));
		xhr.send(formData);
	});
}

let onBatchProgress: ((loaded: number) => void) | null = null;

function setUploading(uploading: boolean): void {
	for (const id of ["upload-cancel", "upload-close"]) {
		const btn = document.getElementById(id) as HTMLButtonElement | null;
		if (btn) btn.disabled = uploading;
	}
	const submit = document.querySelector(
		"#upload-form button[type=submit]",
	) as HTMLButtonElement | null;
	if (submit) submit.disabled = uploading;
}

const MIN_PROGRESS_DISPLAY_MS = 600;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitUpload(): Promise<void> {
	const input = document.getElementById(
		"upload-files",
	) as HTMLInputElement | null;
	const files = Array.from(input?.files ?? []);
	if (files.length === 0) return;

	const progress = document.getElementById("upload-progress");
	const bar = document.getElementById("upload-progress-bar");
	const text = document.getElementById("upload-progress-text");
	progress?.classList.remove("hidden");
	progress?.classList.add("flex");
	setUploading(true);
	const startedAt = Date.now();

	const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
	const batches = batchFiles(files);
	let completedBytes = 0;
	let uploadedCount = 0;

	const updateProgress = (batchLoaded: number) => {
		const pct = Math.min(
			100,
			Math.round(((completedBytes + batchLoaded) / totalBytes) * 100),
		);
		if (bar) bar.style.width = `${pct}%`;
		if (text) text.textContent = `Uploading... ${pct}%`;
	};

	try {
		for (const batch of batches) {
			onBatchProgress = updateProgress;
			uploadedCount += await uploadBatch(batch);
			completedBytes += batch.reduce((sum, f) => sum + f.size, 0);
			updateProgress(0);
		}
		const elapsed = Date.now() - startedAt;
		if (elapsed < MIN_PROGRESS_DISPLAY_MS) {
			await sleep(MIN_PROGRESS_DISPLAY_MS - elapsed);
		}
		window.location.href = `/library?${uploadedCount > 0 ? "ok=upload" : "error=upload"}`;
	} catch {
		window.location.href = "/library?error=upload";
	} finally {
		onBatchProgress = null;
		setUploading(false);
	}
}

document.addEventListener("submit", (e) => {
	if (e.target instanceof HTMLFormElement && e.target.id === "upload-form") {
		e.preventDefault();
		submitUpload();
	}
});

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
