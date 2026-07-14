#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_HOST="${WP_LOCAL_HOST:-127.0.0.1}"
DEFAULT_PORT="${WP_LOCAL_PORT:-8080}"
LOCAL_PHP_CONF_DIR="${ROOT_DIR}/.php/conf.d"

# Prints the combined PHP_INI_SCAN_DIR so Homebrew defaults still load.
build_php_ini_scan_dir() {
  local scan_dir
  scan_dir="$(php --ini | awk -F': ' '/Scan for additional \.ini files in/ {print $2}')"

  if [[ -n "${scan_dir}" && "${scan_dir}" != "(none)" ]]; then
    printf '%s:%s' "${scan_dir}" "${LOCAL_PHP_CONF_DIR}"
    return
  fi

  printf '%s' "${LOCAL_PHP_CONF_DIR}"
}

# Starts the local WordPress server with the tracked high-limit PHP overrides.
main() {
  local host
  local port
  local php_ini_scan_dir

  host="${1:-${DEFAULT_HOST}}"
  port="${2:-${DEFAULT_PORT}}"
  php_ini_scan_dir="$(build_php_ini_scan_dir)"

  cd "${ROOT_DIR}"

  echo "Starting WordPress at http://${host}:${port}"
  echo "Using PHP overrides from ${LOCAL_PHP_CONF_DIR}"

  PHP_INI_SCAN_DIR="${php_ini_scan_dir}" \
    wp server --host="${host}" --port="${port}"
}

main "$@"
