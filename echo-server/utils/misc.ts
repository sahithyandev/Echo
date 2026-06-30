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
