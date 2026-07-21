import { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import type { DbLike } from "../../db/types";
import { SearchResults } from "../../pages/search-results";
import { allowAnonymous } from "../../utils/anonymous";
import { unused } from "../../utils/misc";
import createAuthMiddleware from "../auth/middleware";
import { SearchService } from "./service";

unused(Html);

export default function createSearchModule(db: DbLike) {
	return new Elysia().use(createAuthMiddleware(db)).get(
		"/search",
		async ({ currentUser, redirect, query }) => {
			if (!currentUser && !allowAnonymous) return redirect("/auth/login");
			const results = await SearchService.searchAll(
				db,
				typeof query.q === "string" ? query.q : "",
			);
			return <SearchResults {...results} />;
		},
		{ currentUser: true },
	);
}
