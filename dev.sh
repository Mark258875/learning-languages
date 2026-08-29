#!/usr/bin/env bash
# ponytail: dev-only convenience launcher — the app lives in app/, this saves the cd + install.
# Lives on the `dev` branch only; not meant for `main`.
set -e
cd "$(dirname "$0")/app"
npm install
exec npm run dev:open
