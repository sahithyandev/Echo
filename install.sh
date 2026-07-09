#!/usr/bin/env bash
# Interactive installer for Echo. Usage:
#   curl -fsSL https://raw.githubusercontent.com/sahithyandev/echo/main/install.sh | bash
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

list_versions() {
	curl -fsSL "https://api.github.com/repos/${REPO}/releases" |
		grep -o '"tag_name": *"[^"]*"' |
		sed -E 's/.*"([^"]+)"$/\1/'
}

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

upgrade_systemd() {
	local versions version tmp
	versions="$(list_versions)"
	echo "Available versions:"
	echo "$versions"
	version="$(ask "Version to upgrade to" "$(echo "$versions" | head -1)")"

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
	local versions version id dir
	id="$(docker ps -a --filter "ancestor=ghcr.io/${REPO}" --format '{{.ID}}' | head -1)"
	dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$id")"
	if [ -z "$dir" ] || [ ! -f "$dir/docker-compose.yml" ]; then
		echo "Could not locate the docker-compose.yml for the running Echo container." >&2
		exit 1
	fi

	versions="$(list_versions)"
	echo "Available versions:"
	echo "$versions"
	version="$(ask "Version to upgrade to" "$(echo "$versions" | head -1)")"

	sed -i.bak -E "s#(ghcr\.io/${REPO//\//\\/}):.*#\1:${version}#" "$dir/docker-compose.yml"
	rm -f "$dir/docker-compose.yml.bak"
	(cd "$dir" && docker compose pull && docker compose up -d)
	echo "Echo upgraded to ${version} and restarted."
}

existing_method="$(detect_existing_install)"
if [ -n "$existing_method" ]; then
	do_upgrade="$(ask "Echo is already installed via ${existing_method}. Upgrade instead of reinstalling? [yes/no]" "yes")"
	if [ "$do_upgrade" = "yes" ]; then
		if [ "$existing_method" = "systemd" ]; then
			upgrade_systemd
		else
			upgrade_docker
		fi
		exit 0
	fi
fi

method="binary"
if command -v docker >/dev/null 2>&1; then
	method=$(ask "Install via [docker/binary]" "docker")
fi

jwt_secret="$(openssl rand -hex 32)"
port="$(ask "Port" "3000")"
music_dir="$(ask "Music library directory" "./music")"

if [ "$method" = "docker" ]; then
	dir="$(ask "Install directory" "./echo")"
	mkdir -p "$dir" "$music_dir"
	cat >"$dir/docker-compose.yml" <<EOF
services:
  echo:
    image: ghcr.io/${REPO}:latest
    ports:
      - "${port}:3000"
    restart: unless-stopped
    environment:
      ECHO_JWT_SECRET: ${jwt_secret}
    volumes:
      - ${music_dir}:/music
      - echo-data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 6

volumes:
  echo-data:
EOF
	(cd "$dir" && docker compose up -d)
	echo "Echo is running at http://localhost:${port} (compose file: $dir/docker-compose.yml)"
else
	dir="$(ask "Install directory" "./echo")"
	data_dir="$(ask "Data directory" "$dir/data")"
	mkdir -p "$dir" "$music_dir" "$data_dir"

	url="https://github.com/${REPO}/releases/latest/download/echo-${target}.tar.gz"
	curl -fsSL "$url" | tar -xz -C "$dir"

	cat >"$dir/echo.env" <<EOF
ECHO_JWT_SECRET=${jwt_secret}
NODE_ENV=production
ECHO_PORT=${port}
ECHO_MUSIC_DIR=$(cd "$music_dir" && pwd)
ECHO_DATA_DIR=$(cd "$data_dir" && pwd)
EOF

	systemd_choice="no"
	if [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
		systemd_choice="$(ask "Install as a systemd service (requires sudo)? [yes/no]" "no")"
	fi

	if [ "$systemd_choice" = "yes" ]; then
		install_dir="/opt/echo"
		sudo mkdir -p "$install_dir" /etc/echo
		sudo cp -r "$dir"/. "$install_dir"/
		sudo cp "$dir/echo.env" /etc/echo/echo.env
		sudo tee /etc/systemd/system/echo.service >/dev/null <<EOF
[Unit]
Description=Echo music server
After=network.target

[Service]
Type=simple
WorkingDirectory=${install_dir}
ExecStart=${install_dir}/echo
Restart=on-failure
EnvironmentFile=/etc/echo/echo.env

[Install]
WantedBy=multi-user.target
EOF
		sudo systemctl daemon-reload
		sudo systemctl enable --now echo
		echo "Echo is running as a systemd service at http://localhost:${port}"
	else
		(cd "$dir" && set -a && . ./echo.env && set +a && ./echo) &
		echo "Echo is running at http://localhost:${port} (PID $!, env: $dir/echo.env)"
	fi
fi

proxy_choice="no"
if [ "$(uname -s)" = "Linux" ] && command -v sudo >/dev/null 2>&1; then
	proxy_choice="$(ask "Set up a reverse proxy [nginx/caddy/no]" "no")"
fi

if [ "$proxy_choice" = "nginx" ] || [ "$proxy_choice" = "caddy" ]; then
	domain="$(ask "Domain name pointing to this server" "")"
	if [ -z "$domain" ]; then
		echo "No domain given, skipping reverse proxy setup."
	elif [ "$proxy_choice" = "nginx" ]; then
		sudo tee /etc/nginx/sites-available/echo.conf >/dev/null <<EOF
server {
	listen 80;
	server_name ${domain};

	location / {
		proxy_pass http://127.0.0.1:${port};
		proxy_set_header Host \$host;
		proxy_set_header X-Real-IP \$remote_addr;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto \$scheme;
	}
}
EOF
		sudo ln -sf /etc/nginx/sites-available/echo.conf /etc/nginx/sites-enabled/echo.conf
		sudo nginx -t && sudo systemctl reload nginx
		echo "nginx is proxying ${domain} -> 127.0.0.1:${port}. Run 'sudo certbot --nginx -d ${domain}' for HTTPS."
	else
		sudo tee -a /etc/caddy/Caddyfile >/dev/null <<EOF

${domain} {
	reverse_proxy 127.0.0.1:${port}
}
EOF
		sudo systemctl reload caddy
		echo "caddy is proxying ${domain} -> 127.0.0.1:${port} with automatic HTTPS."
	fi
fi

echo "First account you create becomes the admin."
