export function getRequestInfo(request: Request) {
	const ipAddress =
		request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
	const userAgent = request.headers.get("user-agent") ?? null;
	return { ipAddress, userAgent };
}
