function clearFlashParams(): void {
	const url = new URL(location.href);
	url.searchParams.delete("ok");
	url.searchParams.delete("error");
	history.replaceState(history.state, "", url);
}

function scheduleDismiss(): void {
	document.querySelectorAll<HTMLElement>("[data-flash]").forEach((el) => {
		setTimeout(() => {
			el.classList.add("flash-out");
			setTimeout(() => {
				el.remove();
				clearFlashParams();
			}, 300);
		}, 4000);
	});
}

scheduleDismiss();
document.addEventListener("page:loaded", scheduleDismiss);
