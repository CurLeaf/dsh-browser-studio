#!/usr/bin/env bash
# Rolls the desktop profile back to the newest backup taken by scripts/install-local.sh
# (or by hand). Run it if the app fails to boot after installing the plugin.
set -euo pipefail

PROFILE="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/desktop}"
PNPM="${DSH_PNPM:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs}"

BK="$(find "$PROFILE" -maxdepth 1 -type d -name '.backup-browser-studio-*' -print 2>/dev/null | sort | tail -1)"
if [ -z "${BK:-}" ]; then
  echo "no .backup-browser-studio-* found in $PROFILE" >&2
  exit 1
fi

echo "restoring from $BK"
cp "$BK/package.json" "$PROFILE/package.json"
[ -f "$BK/pnpm-lock.yaml" ] && cp "$BK/pnpm-lock.yaml" "$PROFILE/pnpm-lock.yaml"
[ -f "$BK/cordis.patch.yml" ] && cp "$BK/cordis.patch.yml" "$PROFILE/cordis.patch.yml"

if [ -f "$PNPM" ]; then
  ( cd "$PROFILE" && node "$PNPM" install --reporter=append-only )
else
  echo "pnpm not found at $PNPM; run your package manager manually in $PROFILE" >&2
fi

echo "restored. Restart DeepSeek Harness to unload the plugin."
