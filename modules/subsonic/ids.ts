/** Subsonic IDs are opaque strings shared across artists/albums/tracks; prefix by type to disambiguate. */
export type SubsonicIdType = "ar" | "al" | "tr";

export function makeId(type: SubsonicIdType, id: number): string {
	return `${type}-${id}`;
}

export function parseId(
	s: string | undefined,
): { type: SubsonicIdType; id: number } | null {
	if (!s) return null;
	const match = /^(ar|al|tr)-(\d+)$/.exec(s);
	if (!match) return null;
	return { type: match[1] as SubsonicIdType, id: Number(match[2]) };
}
