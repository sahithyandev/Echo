/**
 * Use this when a variable should be marked as unused explicity.
 * Prefer _unusedVariable pattern. Use this if that's not suitable.
 */
export function unused<T>(_x: T) {}

/**
 * Format seconds into human-friendly minutes:seconds format.
 */
export function formatDuration(s: number | null) {
	if (!s) return "";
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Format seconds into human-friendly hours/minutes format, e.g. "3h 12m".
 */
export function formatHours(s: number | null) {
	if (!s) return "0m";
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The library grouping bucket for a track title: "0-9" for a leading digit,
 * the uppercase letter for a leading A-Z, otherwise "Others". Must match the
 * SQL ordering in `LibraryService.listTracksPage`.
 */
export function trackGroup(title: string): string {
	const c = title.trim().charAt(0).toUpperCase();
	if (c >= "0" && c <= "9") return "0-9";
	if (c >= "A" && c <= "Z") return c;
	return "Others";
}
