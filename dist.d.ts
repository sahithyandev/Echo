// dist/ is built by scripts/build-client.ts and gitignored, so tsc never sees
// these files; declare their shape for the embedded-text imports in
// utils/create-app.tsx.
declare module "../dist/*.js" {
	const content: string;
	export default content;
}

declare module "../dist/*.css" {
	const content: string;
	export default content;
}
