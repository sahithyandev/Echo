const content = document.getElementById("page-content") as HTMLElement;

function swapNav(doc: Document): void {
	const newLinks = doc.querySelectorAll<HTMLAnchorElement>("header nav a");
	const liveLinks =
		document.querySelectorAll<HTMLAnchorElement>("header nav a");
	newLinks.forEach((newLink, i) => {
		liveLinks[i]?.setAttribute("class", newLink.getAttribute("class") ?? "");
	});
}

async function loadPage(url: string, push: boolean): Promise<void> {
	let res: Response;
	try {
		res = await fetch(url);
	} catch {
		location.href = url;
		return;
	}
	if (!res.ok) {
		location.href = url;
		return;
	}
	const doc = new DOMParser().parseFromString(await res.text(), "text/html");
	const newContent = doc.getElementById("page-content");
	if (!newContent) {
		location.href = url;
		return;
	}
	content.innerHTML = newContent.innerHTML;
	document.title = doc.title;
	swapNav(doc);
	if (push) history.pushState({}, "", url);
	window.scrollTo(0, 0);
	document.dispatchEvent(new CustomEvent("page:loaded"));
}

document.addEventListener("click", (e) => {
	if (e.defaultPrevented || e.button !== 0) return;
	if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	const a = (e.target as Element).closest("a");
	if (!(a instanceof HTMLAnchorElement)) return;
	if (a.target || a.hasAttribute("download") || a.origin !== location.origin)
		return;
	e.preventDefault();
	loadPage(a.href, true);
});

window.addEventListener("popstate", () => loadPage(location.href, false));
