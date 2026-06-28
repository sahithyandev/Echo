import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";
import type { DbLike } from "../db/types";
import createAuthModule from "../modules/auth";
import createAuthMiddleware from "../modules/auth/middleware";
import { Auth } from "../modules/auth/service";
import { IndexPage } from "../pages/index";
import { LibraryPage } from "../pages/library";
import { LoginPage } from "../pages/login";
import { unused } from "./misc";

unused(Html);

export async function createApp(db: DbLike) {
	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(html())
		.use(await staticPlugin({ prefix: "/" }))
		.use(authMiddleware)
		.get("/", () => <IndexPage />)
		.get(
			"/login",
			async ({ currentUser, redirect, query }) => {
				if (currentUser) return redirect("/library");
				const register = (await Auth.userCount(db)) === 0;
				return <LoginPage register={register} error={!!query.error} />;
			},
			{ currentUser: true },
		)
		.get(
			"/library",
			async ({ currentUser, redirect }) => {
				if (!currentUser) return redirect("/login");
				const user = await Auth.findUserById(db, currentUser.id);
				return <LibraryPage name={user.name} />;
			},
			{ currentUser: true },
		)
		.use(createAuthModule(db));
}

export type App = Awaited<ReturnType<typeof createApp>>;
