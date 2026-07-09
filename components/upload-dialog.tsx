import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";

unused(Html);

export function UploadButton() {
	return (
		<button
			id="upload-open"
			type="button"
			class="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium px-3 py-1.5 transition-opacity hover:opacity-90 cursor-pointer"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add tracks
		</button>
	);
}

export function UploadEmptyState() {
	return (
		<div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
			<button
				id="upload-open"
				type="button"
				class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center cursor-pointer hover:border-accent transition-colors"
			>
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-accent"
					aria-hidden="true"
				>
					<path d="M12 16V4M12 4l-4 4M12 4l4 4" />
					<path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
				</svg>
				<p class="text-sm text-muted">Your library is empty.</p>
				<p class="text-xs text-subtle">
					Drag and drop audio files, or <span class="text-accent">browse</span>{" "}
					to add tracks
				</p>
			</button>
		</div>
	);
}

export function UploadDialog() {
	return (
		<dialog
			id="upload-dialog"
			class="backdrop:bg-black/50 bg-surface border border-border rounded-xl p-6 w-full max-w-md text-foreground m-auto"
		>
			<form
				id="upload-form"
				method="post"
				action="/library/upload"
				enctype="multipart/form-data"
				class="flex flex-col gap-4"
			>
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold">Add tracks</h2>
					<button
						type="button"
						id="upload-close"
						aria-label="Close"
						class="text-muted hover:text-foreground cursor-pointer"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				<label
					for="upload-files"
					id="upload-dropzone"
					class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-accent transition-colors"
				>
					<svg
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-accent"
						aria-hidden="true"
					>
						<path d="M12 16V4M12 4l-4 4M12 4l4 4" />
						<path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
					</svg>
					<p class="text-sm text-muted">
						Drag and drop audio files here, or{" "}
						<span class="text-accent">browse</span>
					</p>
					<p class="text-xs text-subtle">mp3, flac, m4a, aac, ogg, wav</p>
				</label>
				<div
					id="upload-file-list"
					class="flex flex-col gap-2 max-h-40 overflow-y-auto empty:hidden"
				/>
				<div id="upload-progress" class="hidden flex-col gap-1">
					<div class="h-1.5 rounded-full bg-background overflow-hidden">
						<div
							id="upload-progress-bar"
							class="h-full bg-accent transition-all"
							style="width:0%"
						/>
					</div>
					<p id="upload-progress-text" class="text-xs text-muted" />
				</div>
				<input
					id="upload-files"
					name="files"
					type="file"
					multiple
					accept=".mp3,.flac,.m4a,.aac,.ogg,.wav"
					required
					class="hidden"
				/>

				<div class="flex justify-end gap-2">
					<button
						type="button"
						id="upload-cancel"
						class="rounded-md border border-border text-sm font-medium px-4 py-2 text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-md bg-accent text-accent-foreground text-sm font-medium px-4 py-2 transition-opacity hover:opacity-90 cursor-pointer"
					>
						Upload
					</button>
				</div>
			</form>
		</dialog>
	);
}
