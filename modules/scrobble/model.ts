import { t } from "elysia";

export namespace ScrobbleModel {
	export const HandshakeQuery = t.Object({
		hs: t.String(),
		p: t.Optional(t.String()),
		c: t.Optional(t.String()),
		v: t.Optional(t.String()),
		u: t.String(),
		t: t.String(),
		a: t.String(),
	});
	export type HandshakeQuery = typeof HandshakeQuery.static;

	// AudioScrobbler 1.2 submissions are form-encoded with bracketed keys
	// (a[0], t[0], i[0], ...) rather than real arrays — a plain string record
	// covers both the now-playing and submission bodies.
	export const SubmissionBody = t.Record(t.String(), t.String());
	export type SubmissionBody = typeof SubmissionBody.static;
}
