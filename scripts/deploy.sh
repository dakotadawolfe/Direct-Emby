#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PORT="${PORT:-3000}"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:${PORT}}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required for package and Docker setup" >&2
  exit 1
fi

install_prereqs() {
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    compose_package=""
    if apt-cache show docker-compose-plugin >/dev/null 2>&1; then
      compose_package="docker-compose-plugin"
    elif apt-cache show docker-compose-v2 >/dev/null 2>&1; then
      compose_package="docker-compose-v2"
    else
      compose_package="docker-compose"
    fi
    sudo apt-get install -y ca-certificates curl git openssl docker.io "$compose_package"
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y ca-certificates curl git openssl docker docker-compose-plugin
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y ca-certificates curl git openssl docker docker-compose-plugin
  else
    echo "Unsupported package manager. Install Docker, Docker Compose plugin, Git, curl, and openssl manually." >&2
    exit 1
  fi
}

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  install_prereqs
fi

sudo systemctl enable --now docker >/dev/null 2>&1 || true

cd "$APP_DIR"

if [ ! -f .env ]; then
  secret="$(openssl rand -base64 48)"
  cat > .env <<EOF
NODE_ENV=production
PORT=$PORT
PUBLIC_BASE_URL=$PUBLIC_BASE_URL
ENCRYPTION_SECRET=$secret
CACHE_TTL_SECONDS=300
SETUP_SESSION_TTL_SECONDS=600
EOF
fi

ensure_env_key() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    if [ -n "$value" ]; then
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    fi
  else
    printf "%s=%s\n" "$key" "$value" >> .env
  fi
}

ensure_env_key "PORT" "$PORT"
ensure_env_key "PUBLIC_BASE_URL" "$PUBLIC_BASE_URL"
if [ -n "${CLOUDFLARED_TOKEN:-}" ]; then
  ensure_env_key "CLOUDFLARED_TOKEN" "$CLOUDFLARED_TOKEN"
fi

if grep -q "^CLOUDFLARED_TOKEN=.\+" .env; then
  sudo docker compose --profile cloudflare up -d --build
else
  sudo docker compose up -d --build
fi

for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health"; then
    echo
    exit 0
  fi
  sleep 1
done

echo "DirectEmby did not become healthy on http://127.0.0.1:${PORT}/health" >&2
sudo docker compose ps >&2 || true
sudo docker logs --tail=100 directemby >&2 || true
exit 1
