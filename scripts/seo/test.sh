#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${YOAST_PLUGIN_PATH:?Set YOAST_PLUGIN_PATH to an extracted official wordpress-seo plugin directory}"
if [[ -n "${PLAYGROUND_CLI:-}" ]]; then
  RUNNER=(node "$PLAYGROUND_CLI")
else
  RUNNER=(npx --yes @wp-playground/cli@3.1.56)
fi
"${RUNNER[@]}" php --php=8.2 --wp=6.8 --define RURAL_SEO_TEST 1 \
  --mount "$ROOT/wp-content/mu-plugins:/wordpress/wp-content/mu-plugins" \
  --mount "$ROOT/wp-content/plugins/woocommerce:/wordpress/wp-content/plugins/woocommerce" \
  --mount "$YOAST_PLUGIN_PATH:/wordpress/wp-content/plugins/wordpress-seo" \
  --mount "$ROOT/scripts/seo:/seo" \
  --mount "$ROOT/wp-content/themes/weerts:/theme" \
  --blueprint "$ROOT/scripts/seo/test-blueprint.json" -- /seo/test-integration.php
