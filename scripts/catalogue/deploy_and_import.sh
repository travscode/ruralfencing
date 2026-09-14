#!/usr/bin/env bash
#
# Push the catalogue plugins, the built catalogue and the needed Zen photos to a WordPress server
# and run the import there. Safe to rerun: the importer updates by SKU and skips unchanged rows.
#
# Usage:
#   scripts/catalogue/deploy_and_import.sh [--dry-run] [--skip-images] [--no-import]
#
# Environment (defaults match the current test server):
#   SSH_USER=ruraltravis SSH_HOST=rural.travis.work SSH_PORT=22
#   SSH_KEY=./weerts_github_actions REMOTE_WP_ROOT=/home/ruraltravis/public_html
#   REMOTE_STAGE=/home/ruraltravis/catalogue-import   CHUNK=250
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SSH_USER="${SSH_USER:-ruraltravis}"
SSH_HOST="${SSH_HOST:-rural.travis.work}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$ROOT/weerts_github_actions}"
REMOTE_WP_ROOT="${REMOTE_WP_ROOT:-/home/$SSH_USER/public_html}"
REMOTE_STAGE="${REMOTE_STAGE:-/home/$SSH_USER/catalogue-import}"
CHUNK="${CHUNK:-250}"
CATALOGUE="$ROOT/ignore/catalogue"
IMAGES="$ROOT/ignore/images"

DRY=""
SKIP_IMAGES=""
DO_IMPORT=1
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY="--dry-run" ;;
    --skip-images) SKIP_IMAGES="--skip-images" ;;
    --no-import) DO_IMPORT=0 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

[ -f "$CATALOGUE/products.csv" ] || { echo "Build the catalogue first: python3 scripts/catalogue/build_catalogue.py" >&2; exit 1; }

SSH_CMD="ssh -i $SSH_KEY -p $SSH_PORT"
REMOTE="$SSH_USER@$SSH_HOST"
RSYNC="rsync -az -e $SSH_CMD"

echo ">> plugins"
$RSYNC "$ROOT/wp-content/plugins/rural-catalogue/" "$REMOTE:$REMOTE_WP_ROOT/wp-content/plugins/rural-catalogue/"
$RSYNC "$ROOT/wp-content/plugins/rural-xero-sync/" "$REMOTE:$REMOTE_WP_ROOT/wp-content/plugins/rural-xero-sync/"

echo ">> catalogue + photos"
$SSH_CMD "$REMOTE" "mkdir -p '$REMOTE_STAGE/images'"
$RSYNC "$CATALOGUE/products.csv" "$REMOTE:$REMOTE_STAGE/products.csv"
if [ -z "$SKIP_IMAGES" ]; then
  $RSYNC --files-from="$CATALOGUE/images_manifest.txt" "$IMAGES/" "$REMOTE:$REMOTE_STAGE/images/"
fi

echo ">> activate plugins, seed categories"
$SSH_CMD "$REMOTE" "cd '$REMOTE_WP_ROOT' && wp plugin activate rural-catalogue rural-xero-sync >/dev/null 2>&1 || true; wp weerts seed-product-cats 2>&1 | tail -1; wp option update woocommerce_manage_stock yes >/dev/null"

[ "$DO_IMPORT" = 1 ] || { echo "deployed, import skipped"; exit 0; }

echo ">> import (chunks of $CHUNK)"
$SSH_CMD "$REMOTE" "cd '$REMOTE_WP_ROOT' && export WP_CLI_PHP_ARGS='-d memory_limit=512M' && total=\$(( \$(grep -c . '$REMOTE_STAGE/products.csv') )) && off=0 && while [ \$off -lt \$total ]; do echo \"--- offset \$off\"; wp rural catalogue import --file='$REMOTE_STAGE/products.csv' --images='$REMOTE_STAGE/images' --offset=\$off --limit=$CHUNK $DRY $SKIP_IMAGES 2>&1 | grep -vE '^\s*$|Importing' | tail -3; off=\$(( off + $CHUNK )); done; wp rural catalogue status"
