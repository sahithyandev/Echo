#!/usr/bin/env bash
# Interactive upgrade script for Echo. Usage:
#   curl -fsSL https://raw.githubusercontent.com/sahithyandev/echo/main/upgrade.sh | bash
set -euo pipefail

REPO="sahithyandev/echo"

ask() {
	# ask "prompt" "default" -> prints answer
	local prompt="$1" default="$2" reply
	read -r -p "$prompt [$default]: " reply </dev/tty || true
	echo "${reply:-$default}"
}

target="$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')"
case "$target" in
linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64) ;;
*)
	echo "Unsupported platform: $target" >&2
	exit 1
	;;
esac

detect_existing_install() {
	if command -v systemctl >/dev/null 2>&1 && [ -f /etc/systemd/system/echo.service ]; then
		echo "systemd"
		return
	fi
	if command -v docker >/dev/null 2>&1; then
		local id
		id="$(docker ps -a --filter "ancestor=ghcr.io/${REPO}" --format '{{.ID}}' | head -1)"
		if [ -n "$id" ]; then
			echo "docker"
			return
		fi
	fi
}

ask_version() {
	local version
	version="$(ask "Version to upgrade to (see https://github.com/${REPO}/releases, e.g. v0.1.0)" "")"
	if [ -z "$version" ]; then
		echo "A version is required." >&2
		exit 1
	fi
	echo "$version"
}

upgrade_systemd() {
	local version tmp
	version="$(ask_version)"

	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT
	url="https://github.com/${REPO}/releases/download/${version}/echo-${target}.tar.gz"
	curl -fsSL "$url" | tar -xz -C "$tmp"

	sudo systemctl stop echo
	sudo cp -r "$tmp"/. /opt/echo/
	sudo systemctl start echo
	echo "Echo upgraded to ${version} and restarted."
}

upgrade_docker() {
	local version id dir
	id="$(docker ps -a --filter "ancestor=ghcr.io/${REPO}" --format '{{.ID}}' | head -1)"
	dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$id")"
	if [ -z "$dir" ] || [ ! -f "$dir/docker-compose.yml" ]; then
		echo "Could not locate the docker-compose.yml for the running Echo container." >&2
		exit 1
	fi

	version="$(ask_version)"

	sed -i.bak -E "s#(ghcr\.io/${REPO//\//\\/}):.*#\1:${version}#" "$dir/docker-compose.yml"
	rm -f "$dir/docker-compose.yml.bak"
	(cd "$dir" && docker compose pull && docker compose up -d)
	echo "Echo upgraded to ${version} and restarted."
}

method="$(detect_existing_install)"
if [ -z "$method" ]; then
	method="$(ask "Could not detect an existing Echo install. Upgrade method [systemd/docker]" "docker")"
fi

case "$method" in
systemd) upgrade_systemd ;;
docker) upgrade_docker ;;
*)
	echo "Unknown method: $method" >&2
	exit 1
	;;
esac
