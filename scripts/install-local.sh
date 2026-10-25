#!/usr/bin/env bash
# Links this checkout into the Desktop profile for a live test.
# Backs up package.json / pnpm-lock.yaml / cordis.patch.yml first.
set -euo pipefail

PROFILE="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/desktop}"
PNPM="${DSH_PNPM:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$PROFILE/.backup-browser-studio-$TS"

mkdir -p "$BK"
cp "$PROFILE/package.json" "$BK/package.json"
cp "$PROFILE/pnpm-lock.yaml" "$BK/pnpm-lock.yaml"
cp "$PROFILE/cordis.patch.yml" "$BK/cordis.patch.yml"

node - "$PROFILE/package.json" "$ROOT" <<'NODE'
const fs = require('node:fs')
const [file, root] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
pkg.dependencies['dsh-browser-studio'] = `link:${root}`
const bundles = pkg.dsh.profile.bundles
if (!bundles.includes('dsh-browser-studio')) bundles.push('dsh-browser-studio')
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
NODE

( cd "$PROFILE" && node "$PNPM" install --reporter=append-only )

echo
echo "installed into $PROFILE (backup: $BK)"
echo "restart DeepSeek Harness (Cmd+Q, then reopen)."
echo "rollback: scripts/uninstall-local.sh"
