<?php
/**
 * Plugin Name: Rural Xero Sync
 * Description: Keeps WooCommerce stock in step with Xero inventory and posts paid web orders to Xero as sales invoices, which is how Xero decrements stock. No third-party service in between.
 * Version: 1.0.0
 * Author: Weerts
 * Requires Plugins: woocommerce
 * Requires PHP: 8.1
 */

if (!defined('ABSPATH')) {
    exit;
}

define('RURAL_XERO_VERSION', '1.0.0');
define('RURAL_XERO_FILE', __FILE__);
define('RURAL_XERO_DIR', plugin_dir_path(__FILE__));

require_once RURAL_XERO_DIR . 'includes/class-logger.php';
require_once RURAL_XERO_DIR . 'includes/class-settings.php';
require_once RURAL_XERO_DIR . 'includes/class-oauth.php';
require_once RURAL_XERO_DIR . 'includes/class-api.php';
require_once RURAL_XERO_DIR . 'includes/class-stock-sync.php';
require_once RURAL_XERO_DIR . 'includes/class-order-sync.php';
require_once RURAL_XERO_DIR . 'includes/class-admin.php';

add_action('plugins_loaded', static function (): void {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>Rural Xero Sync needs WooCommerce.</p></div>';
        });
        return;
    }
    Rural_Xero\OAuth::instance()->hooks();
    Rural_Xero\Stock_Sync::instance()->hooks();
    Rural_Xero\Order_Sync::instance()->hooks();
    Rural_Xero\Admin::instance()->hooks();
    if (defined('WP_CLI') && WP_CLI) {
        require_once RURAL_XERO_DIR . 'includes/class-cli.php';
        WP_CLI::add_command('rural xero', 'Rural_Xero\CLI');
    }
});

register_activation_hook(__FILE__, static function (): void {
    Rural_Xero\Admin::register_role();
    if (function_exists('as_schedule_recurring_action')) {
        Rural_Xero\Stock_Sync::instance()->ensure_schedule();
    }
});

register_deactivation_hook(__FILE__, static function (): void {
    if (function_exists('as_unschedule_all_actions')) {
        as_unschedule_all_actions(Rural_Xero\Stock_Sync::HOOK);
    }
});
