import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";

unused(Html);

export function Flash({
	variant,
	message,
}: {
	variant: "ok" | "error";
	message?: string;
}) {
	if (!message) return null;
	return (
		<p
			data-flash
			class={`fixed bottom-4 right-4 z-50 max-w-sm text-xs rounded-md px-3 py-2 border shadow-lg transition-all duration-300 ${
				variant === "error"
					? "text-red-400 bg-red-400/10 border-red-400/30"
					: "text-accent bg-accent/10 border-accent/30"
			}`}
		>
			{message}
		</p>
	);
}
