import { CString, dlopen, FFIType, type Pointer, ptr, read } from "bun:ffi";

const LIB =
	process.arch === "arm64"
		? "/opt/homebrew/lib/libchromaprint.dylib"
		: "/usr/local/lib/libchromaprint.dylib";

// CHROMAPRINT_ALGORITHM_TEST2 — the default, same as fpcalc
const ALGORITHM = 1;

let ffi: ReturnType<typeof dlopen<typeof ffiSymbols>>["symbols"] | undefined;

const ffiSymbols = {
	chromaprint_new: {
		args: [FFIType.i32],
		returns: FFIType.ptr,
	},
	chromaprint_free: {
		args: [FFIType.ptr],
		returns: FFIType.void,
	},
	chromaprint_start: {
		args: [FFIType.ptr, FFIType.i32, FFIType.i32],
		returns: FFIType.i32,
	},
	chromaprint_feed: {
		args: [FFIType.ptr, FFIType.ptr, FFIType.i32],
		returns: FFIType.i32,
	},
	chromaprint_finish: {
		args: [FFIType.ptr],
		returns: FFIType.i32,
	},
	chromaprint_get_fingerprint: {
		args: [FFIType.ptr, FFIType.ptr],
		returns: FFIType.i32,
	},
	chromaprint_dealloc: {
		args: [FFIType.ptr],
		returns: FFIType.void,
	},
} as const;

/**
 * Lazily dlopen's libchromaprint on first use. Deferred (rather than a
 * top-level dlopen) so importing this module for FPCALC_AVAILABLE/
 * fingerprintFile — the only paths the running server actually uses — works
 * on platforms without the mac-only .dylib, e.g. Linux containers.
 */
function getFfi() {
	if (!ffi) ffi = dlopen(LIB, ffiSymbols).symbols;
	return ffi;
}

export const FPCALC_AVAILABLE = Bun.which("fpcalc") !== null;

const MAX_SECONDS = 30;

/**
 * Compute a Chromaprint fingerprint from raw signed 16-bit PCM samples.
 * `samples.length` is the number of samples (not bytes).
 */
export function computeFingerprint(
	samples: Int16Array,
	sampleRate: number,
	channels: number,
): string {
	const ffi = getFfi();
	const maxSamples = sampleRate * channels * MAX_SECONDS;
	const limited =
		samples.length > maxSamples ? samples.subarray(0, maxSamples) : samples;
	const ctx = ffi.chromaprint_new(ALGORITHM);
	try {
		if (!ffi.chromaprint_start(ctx, sampleRate, channels))
			throw new Error("chromaprint_start failed");
		if (!ffi.chromaprint_feed(ctx, ptr(limited), limited.length))
			throw new Error("chromaprint_feed failed");
		if (!ffi.chromaprint_finish(ctx))
			throw new Error("chromaprint_finish failed");

		// char** — 8-byte buffer receives the pointer written by chromaprint
		const ptrBuf = new Uint8Array(8);
		const ptrBufAddr = ptr(ptrBuf);
		if (!ffi.chromaprint_get_fingerprint(ctx, ptrBufAddr))
			throw new Error("chromaprint_get_fingerprint failed");

		const fpPtr = read.ptr(ptrBufAddr, 0) as unknown as Pointer;
		const fingerprint = new CString(fpPtr).toString();
		ffi.chromaprint_dealloc(fpPtr);
		return fingerprint;
	} finally {
		ffi.chromaprint_free(ctx);
	}
}

/**
 * Fingerprint an audio file using fpcalc (ships with the chromaprint brew formula).
 * Handles audio decoding internally — no ffmpeg required separately.
 */
export async function fingerprintFile(filePath: string): Promise<string> {
	const result =
		await Bun.$`fpcalc -plain -length ${MAX_SECONDS} ${filePath}`.text();
	const fingerprint = result.trim();
	if (!fingerprint) throw new Error(`fpcalc returned nothing for ${filePath}`);
	return fingerprint;
}
