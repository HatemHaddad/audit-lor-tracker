#!/usr/bin/env bash
# One-shot installer/updater for an Ubuntu/Debian VPS.
#   first time:  bash deploy.sh lor.example.com      (or no argument to use the server IP over HTTP)
#   updates:     git pull && bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi

DOMAIN="${1:-}"
if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  sed -i "s|<run: openssl rand -hex 32>|$(openssl rand -hex 32)|; s|<run: openssl rand -hex 24>|$(openssl rand -hex 24)|" .env.production
  PASS=$(openssl rand -base64 12 | tr -d '/+=')
  sed -i "s|<access password for the site>|$PASS|" .env.production
  if [ -n "$DOMAIN" ]; then URL="https://$DOMAIN"; else URL="http://$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"; fi
  sed -i "s|^APP_URL=.*|APP_URL=\"$URL\"|" .env.production
  echo "Created .env.production — site password: $PASS  (edit the file to change it or add API keys)"
fi

if [ -n "$DOMAIN" ]; then echo "SITE_ADDRESS=$DOMAIN" > .env; elif [ ! -f .env ]; then echo "SITE_ADDRESS=:80" > .env; fi

docker compose up -d --build
docker compose ps
echo
echo "LOR Tracker is starting at: $(grep ^APP_URL .env.production | cut -d'"' -f2)"
echo "Daily reminders: add this to crontab -e"
echo "  0 6 * * * curl -fsS -H \"Authorization: Bearer $(grep ^CRON_SECRET .env.production | cut -d'"' -f2)\" http://localhost/api/cron/followup >/dev/null"
