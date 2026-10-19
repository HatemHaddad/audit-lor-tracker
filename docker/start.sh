#!/bin/sh
set -e
mkdir -p /app/data/storage
# Create/upgrade tables (non-destructive)
npx prisma db push --skip-generate
# Load demo data only on an empty database when SEED_DEMO=1
if [ "$SEED_DEMO" = "1" ]; then npx tsx prisma/seed.ts; fi
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
