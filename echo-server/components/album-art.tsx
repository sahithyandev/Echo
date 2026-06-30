import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";

unused(Html);

export function AlbumArt({ size = 36 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 36 36"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="rounded-sm shrink-0"
			role="img"
			aria-label="Album art"
		>
			<rect
				width="36"
				height="36"
				rx="4"
				fill="currentColor"
				class="text-surface"
			/>
			<rect width="36" height="36" rx="4" fill="url(#grad)" />
			<g transform="translate(3 0)">
				<path
					d="M22 11v9.27A3 3 0 1 1 20 18V13l-6 1.5V22a3 3 0 1 1-2-2.83V13.5L22 11Z"
					fill="currentColor"
					class="text-muted"
					opacity="0.7"
				/>
			</g>
			<defs>
				<linearGradient
					id="grad"
					x1="0"
					y1="0"
					x2="36"
					y2="36"
					gradientUnits="userSpaceOnUse"
				>
					<stop stop-color="var(--color-surface)" />
					<stop offset="1" stop-color="var(--color-border)" />
				</linearGradient>
			</defs>
		</svg>
	);
}
