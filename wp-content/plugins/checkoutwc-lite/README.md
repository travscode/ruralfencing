# Checkout for WooCommerce

Beautiful, conversion-optimized checkout templates for WooCommerce.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 (see `.nvmrc`) |
| pnpm | 9.15.4 (enforced — npm/yarn won't work) |
| PHP | 7.4+ |
| Composer | 2.x |
| Local WordPress + WooCommerce dev site | Any local dev environment (LocalWP, wp-env, DDEV, etc.) |

## Quick Start

Clone the repository into your WordPress plugins directory:

```bash
cd /path/to/your/wordpress/wp-content/plugins
git clone <repo-url>
cd checkout-for-woocommerce
```

Or clone it anywhere and symlink it into your plugins directory:

```bash
git clone <repo-url> ~/projects/checkout-for-woocommerce
ln -s ~/projects/checkout-for-woocommerce /path/to/your/wordpress/wp-content/plugins/checkout-for-woocommerce
```

Then build:

```bash
pnpm build_dev
```

### Enable Development Mode

Add the following to your WordPress `wp-config.php`:

```php
define( 'CFW_DEV_MODE', true );
```

This enables PHP debugging features: Kint debugger, visible PHP errors, dev API endpoints, and SSL verification bypass for local dev.

> **Note:** `CFW_DEV_MODE` does **not** control JavaScript minification or source maps. Those are determined by the build command: `pnpm run start` (dev mode — unminified, with source maps) vs `pnpm run build` (production mode — minified, no source maps).

### `.env` file (optional)

A `.env` file in the project root is read by webpack only. You can use it for build-time settings:

```
ENABLE_WEBPACK_NOTIFICATIONS=false
```

## Common Commands

| Command | Description |
|---|---|
| `pnpm build_dev` | Full development build (composer + templates + main assets) |
| `pnpm build_prod` | Production build with tests → zip files in `./dist/` |
| `pnpm build_prod --skip-tests` | Production build without running tests |
| `pnpm run start` | Dev mode via `wp-scripts start` (file watching, source maps, no minification) |
| `pnpm wp-env start` | Start local WordPress test environment |
| `pnpm run test` | E2E tests with Playwright UI |
| `pnpm run test:headless` | E2E tests headless |
| `pnpm run phpunit` | PHP unit tests |
| `pnpm run min_php_version_test` | PHP 7.4 compatibility check |
| `pnpm run max_php_version_test` | PHP 8.3 compatibility check |
| `pnpm run make:pot` | Generate translation `.pot` file |
| `pnpm run make:json` | Generate JSON translation files for webpack chunks |

## Good to Know

- **pnpm is enforced** — a `preinstall` script rejects npm/yarn.
- **Templates have isolated npm installs** — each template in `templates/*/` has its own `node_modules` and uses `npm` (not pnpm) for its build. This is because templates use `@wordpress/scripts` independently.
- **`CFW_DEV_MODE`** is a PHP constant set in `wp-config.php`. It enables PHP debugging features (Kint, error display, dev API endpoints) — it does **not** affect JavaScript builds.
- **Production build runs tests by default** — pass `--skip-tests` to skip. Tests require `wp-env`.
- **Pro and Lite from one codebase** — `pnpm build_prod` produces two zip files. The Lite build aggressively strips premium files. When adding new pro-only features, you must manually add their files to the removal list in `bin/build-prod.sh`.
- **Strauss namespace prefixing** — all Composer vendor dependencies are copied to `vendor-prefixed/` with namespaces prefixed to `CheckoutWC\` to avoid conflicts with other plugins.

## Testing Environment

Uses `wp-env`. You may need a `.wp-env.override.json` and/or these env variables:

```
WP_ENV_HOST=localhost
WP_ENV_PORT=8994
WP_ENV_TESTS_PORT=8995
```

## Further Documentation

See the [GitHub Wiki](https://github.com/kestrelcommerce/checkout-for-woocommerce/wiki) for detailed architecture and build documentation.
