import { Html, html } from "@elysiajs/html";
import staticPlugin from "@elysiajs/static";
import tailwind from "bun-plugin-tailwind";
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
	const cssPath = new URL("../styles.css", import.meta.url).pathname;
	const cssBuild = await Bun.build({
		entrypoints: [cssPath],
		plugins: [tailwind],
	});
	if (!cssBuild.success)
		throw new Error(`CSS build failed: ${cssBuild.logs.join("\n")}`);
	const css = await cssBuild.outputs[0].text();

	const authMiddleware = createAuthMiddleware(db);
	return new Elysia()
		.use(html())
		.get(
			"/global.css",
			() =>
				new Response(css, {
					headers: { "content-type": "text/css; charset=utf-8" },
				}),
		)
		.use(await staticPlugin({ prefix: "/" }))
		.use(authMiddleware)
		.get("/", () => <IndexPage />)
		.get(
			"/login",
			async ({ currentUser, redirect, query }) => {
				if (currentUser) return redirect("/library");
				const usersCount = await Auth.userCount(db);

				const register = usersCount === 0;
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
