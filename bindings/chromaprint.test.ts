import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeFingerprint, fingerprintFile } from "./chromaprint";

// --- helpers ---

function sineWave(
	freqHz: number,
	durationSecs: number,
	sampleRate: number,
): Int16Array {
	const samples = new Int16Array(Math.floor(sampleRate * durationSecs));
	for (let i = 0; i < samples.length; i++) {
		samples[i] = Math.round(
			Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * 16000,
		);
	}
	return samples;
}

// Mix multiple frequencies; different pitch classes → different chroma profiles
function chord(
	freqsHz: number[],
	durationSecs: number,
	sampleRate: number,
): Int16Array {
	const samples = new Int16Array(Math.floor(sampleRate * durationSecs));
	for (let i = 0; i < samples.length; i++) {
		let v = 0;
		for (const f of freqsHz) v += Math.sin((2 * Math.PI * f * i) / sampleRate);
		samples[i] = Math.round((v / freqsHz.length) * 16000);
	}
	return samples;
}

function makeWav(
	samples: Int16Array,
	sampleRate: number,
	channels: number,
): Uint8Array {
	const dataSize = samples.byteLength;
	const buf = Buffer.alloc(44 + dataSize);
	buf.write("RIFF", 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write("WAVE", 8);
	buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20); // PCM
	buf.writeUInt16LE(channels, 22);
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * channels * 2, 28);
	buf.writeUInt16LE(channels * 2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write("data", 36);
	buf.writeUInt32LE(dataSize, 40);
	Buffer.from(samples.buffer).copy(buf, 44);
	return new Uint8Array(buf);
}

async function writeTmpWav(
	samples: Int16Array,
	sampleRate: number,
	channels: number,
): Promise<string> {
	const path = join(tmpdir(), `chromaprint-test-${Date.now()}.wav`);
	await Bun.write(path, makeWav(samples, sampleRate, channels));
	return path;
}

// --- computeFingerprint ---

describe("computeFingerprint", () => {
	const samples = sineWave(440, 5, 11025); // 5s @ 11025 Hz mono

	it("returns a non-empty string", () => {
		const fp = computeFingerprint(samples, 11025, 1);
		expect(typeof fp).toBe("string");
		expect(fp.length).toBeGreaterThan(0);
	});

	it("is deterministic", () => {
		const fp1 = computeFingerprint(samples, 11025, 1);
		const fp2 = computeFingerprint(samples, 11025, 1);
		expect(fp1).toBe(fp2);
	});

	it("differs for different audio", () => {
		const tone = computeFingerprint(sineWave(440, 5, 11025), 11025, 1);
		const silence = computeFingerprint(new Int16Array(11025 * 5), 11025, 1);
		expect(tone).not.toBe(silence);
	});
});

// --- fingerprintFile ---

describe("fingerprintFile", () => {
	const samples = sineWave(440, 5, 44100);

	it("returns a non-empty string for a valid WAV", async () => {
		const path = await writeTmpWav(samples, 44100, 1);
		const fp = await fingerprintFile(path);
		expect(typeof fp).toBe("string");
		expect(fp.length).toBeGreaterThan(0);
	});

	it("is deterministic across calls", async () => {
		const path = await writeTmpWav(samples, 44100, 1);
		const fp1 = await fingerprintFile(path);
		const fp2 = await fingerprintFile(path);
		expect(fp1).toBe(fp2);
	});

	it("differs for different audio files", async () => {
		// C major vs F# major — no shared pitch classes, distinct chroma profiles
		const pathA = await writeTmpWav(
			chord([261, 329, 392], 10, 44100),
			44100,
			1,
		);
		const pathB = await writeTmpWav(
			chord([370, 466, 554], 10, 44100),
			44100,
			1,
		);
		const fpA = await fingerprintFile(pathA);
		const fpB = await fingerprintFile(pathB);
		expect(fpA).not.toBe(fpB);
	});

	it("rejects a non-existent file", async () => {
		await expect(fingerprintFile("/tmp/no-such-file.wav")).rejects.toThrow();
	});
});
