import { Html } from "@elysiajs/html";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { users } from "../../db/schema";
import type { DbLike } from "../../db/types";
import { HomePage } from "../../pages/home";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { LibraryService } from "../library/service";

unused(Html);

const RECENT_LIMIT = 12;

export default function createHomeModule(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia().use(authMiddleware).get(
		"/",
		async ({ currentUser, redirect }) => {
			if (!currentUser) return redirect("/auth/login");

			const [user, playback, recentlyAdded, recentlyPlayed] = await Promise.all(
				[
					Auth.findUserById(db, currentUser.id),
					db
						.select({ playback_track_id: users.playback_track_id })
						.from(users)
						.where(eq(users.id, currentUser.id))
						.limit(1),
					LibraryService.listRecentlyAdded(db, RECENT_LIMIT),
					LibraryService.listRecentlyPlayed(db, currentUser.id, RECENT_LIMIT),
				],
			);

			const playbackTrackId = playback[0]?.playback_track_id ?? null;
			const continueListening = playbackTrackId
				? await LibraryService.findTrackEntryById(db, playbackTrackId)
				: null;

			return (
				<HomePage
					name={user.name}
					continueListening={continueListening}
					recentlyAdded={recentlyAdded}
					recentlyPlayed={recentlyPlayed.filter(
						(t) => t.id !== playbackTrackId,
					)}
				/>
			);
		},
		{ currentUser: true },
	);
}
