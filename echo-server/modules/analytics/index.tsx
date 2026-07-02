import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { AnalyticsPage } from "../../pages/analytics";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { AnalyticsService } from "./service";

unused(Html);

export default function createAnalyticsModule(db: DbLike) {
	return new Elysia().use(createAuthMiddleware(db)).get(
		"/analytics",
		async ({ currentUser, redirect }) => {
			if (!currentUser) return redirect("/auth/login");
			const [totalSeconds, byArtist, byAlbum, byYear, byDay] =
				await Promise.all([
					AnalyticsService.totalPlaybackSeconds(db, currentUser.id),
					AnalyticsService.playbackByArtist(db, currentUser.id),
					AnalyticsService.playbackByAlbum(db, currentUser.id),
					AnalyticsService.playbackByYear(db, currentUser.id),
					AnalyticsService.playbackByDay(db, currentUser.id),
				]);
			return (
				<AnalyticsPage
					totalSeconds={totalSeconds}
					byArtist={byArtist}
					byAlbum={byAlbum}
					byYear={byYear}
					byDay={byDay}
				/>
			);
		},
		{ currentUser: true },
	);
}
