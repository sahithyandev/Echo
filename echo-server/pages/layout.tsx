import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";

unused(Html);

export function Layout({
	title,
	children,
}: {
	title: string;
	children: JSX.Element | JSX.Element[];
}) {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title}</title>
				<link rel="stylesheet" href="/global.css" />
			</head>
			<body>{children}</body>
		</html>
	);
}
