import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

export function LibraryPage({ name }: { name: string }) {
	return (
		<Layout title="Echo — Library">
			<div class="wordmark">Echo</div>
			<p class="tagline">Welcome, {name}</p>

			<p class="library-empty">Your library is empty.</p>

			<form method="post" action="/auth/sign-out">
				<button type="submit" class="cta sign-out">
					Sign out
				</button>
			</form>
		</Layout>
	);
}
