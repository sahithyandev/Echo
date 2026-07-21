const content = document.getElementById("page-content") as HTMLElement;

function swapNav(doc: Document): void {
	const newHeader = doc.querySelector("header");
	const liveHeader = document.querySelector("header");
	if (!liveHeader && newHeader) {
		document.body.prepend(newHeader);
		return;
	}
	if (liveHeader && !newHeader) {
		liveHeader.remove();
		return;
	}
	const newLinks = doc.querySelectorAll<HTMLAnchorElement>("header nav a");
	const liveLinks =
		document.querySelectorAll<HTMLAnchorElement>("header nav a");
	newLinks.forEach((newLink, i) => {
		liveLinks[i]?.setAttribute("class", newLink.getAttribute("class") ?? "");
	});
}

async function loadPage(
	url: string,
	push: boolean,
	init?: RequestInit,
): Promise<void> {
	let res: Response;
	try {
		res = await fetch(url, init);
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
	if (push) history.pushState({}, "", res.url || url);
	window.scrollTo(0, 0);
	document.dispatchEvent(new CustomEvent("page:loaded"));
}

document.addEventListener("change", (e) => {
	if (!(e.target instanceof HTMLSelectElement)) return;
	if (e.target.id !== "signup_mode") return;
	const emails = document.getElementById(
		"allowed_emails",
	) as HTMLTextAreaElement | null;
	if (emails) emails.disabled = e.target.value !== "allowlist";
});

document.addEventListener("click", (e) => {
	if (!(e.target instanceof Element)) return;
	const button = e.target.closest<HTMLElement>("[data-generate-key]");
	if (!button) return;
	const input = document.getElementById(
		button.dataset.generateKey ?? "",
	) as HTMLInputElement | null;
	if (input) input.value = crypto.randomUUID().replace(/-/g, "");
});

document.addEventListener("click", (e) => {
	if (!(e.target instanceof Element)) return;
	const button = e.target.closest("[data-copy-key]");
	if (!(button instanceof HTMLButtonElement)) return;
	const input = document.getElementById(
		button.dataset.copyKey ?? "",
	) as HTMLInputElement | null;
	if (!input?.value) return;
	navigator.clipboard.writeText(input.value).then(() => {
		const original = button.textContent;
		button.textContent = "Copied!";
		setTimeout(() => {
			button.textContent = original;
		}, 1500);
	});
});

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

document.addEventListener("submit", (e) => {
	const form = e.target;
	if (!(form instanceof HTMLFormElement)) return;
	if (form.method.toLowerCase() !== "post") return;
	if (form.target || form.enctype !== "application/x-www-form-urlencoded")
		return;
	const url = new URL(form.action);
	if (url.origin !== location.origin) return;
	e.preventDefault();
	if (url.pathname === "/auth/sign-out") {
		document.dispatchEvent(new CustomEvent("auth:signout"));
	}
	const params = new URLSearchParams();
	for (const [key, value] of new FormData(form)) {
		if (typeof value === "string") params.append(key, value);
	}
	loadPage(url.pathname + url.search, true, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params,
	});
});

window.addEventListener("popstate", () => loadPage(location.href, false));
