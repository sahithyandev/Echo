import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { LibraryPage } from "../../pages/library";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { Auth } from "../auth/service";
import { LibraryService } from "./service";

unused(Html);

export default function createLibraryModule(db: DbLike) {
	return new Elysia({ prefix: "/library" }).use(createAuthMiddleware(db)).get(
		"/",
		async ({ currentUser, redirect }) => {
			if (!currentUser) return redirect("/login");
			const [user, tracks] = await Promise.all([
				Auth.findUserById(db, currentUser.id),
				LibraryService.listTracks(db),
			]);
			return <LibraryPage name={user.name} tracks={tracks} />;
		},
		{ currentUser: true },
	);
}
