<?php
/** 
 *
 * @link              https://myworks.software/
 * @since             1.1
 * @package           MyWorks_WC_Xero_Sync
 *
 * @wordpress-plugin
 * Plugin Name:       MyWorks Sync for WooCommerce & Xero
 * Plugin URI:        https://myworks.software/integrations/woocommerce-xero-sync/
 * Description:       Automatically sync your WooCommerce store with Xero - in real-time! Easily sync customers, orders, payments, products, inventory and more between your WooCommerce store and Xero. Your complete solution to streamline your accounting workflow.
 * Version:           1.3.2
 * Author:            MyWorks
 * Author URI:        https://myworks.software/
 * Developer: 		  MyWorks
 * Developer URI:     https://myworks.software/
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       myworks-sync-for-xero
 * Domain Path:       /languages
 * Requires at least: 5.3
 * Requires PHP: 5.6
 * Requires Plugins: woocommerce
 * WC requires at least: 4.0.0
 * WC tested up to: 10.4
 *
 * Copyright: © 2011-2026 MyWorks Software.
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

#Config
require plugin_dir_path( __FILE__ ) . 'p-config-s.php';

// Debug logging constant - set to false to disable all debug logging
if ( ! defined( 'MW_XERO_DEBUG_LOGGING' ) ) {
	define( 'MW_XERO_DEBUG_LOGGING', false );  // Change to false to disable logging
}

/**
 * Currently plugin version.
 * Start at version 1.0.0 and use SemVer - https://semver.org
 * Rename this for your plugin and update it as you release new versions.
 */
#define( 'MW_WC_XERO_SYNC_PLUGIN_VERSION', '1.0.0' );

/*HPOS compatibility declare*/
add_action( 'before_woocommerce_init', function() {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-myworks-woo-sync-for-xero-activator.php
 */
function myworks_woo_sync_for_xero_activate() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-myworks-woo-sync-for-xero-activator.php';
	MyWorks_WC_Xero_Sync_Activator::activate();
}


/**
 * The code that runs during plugin deactivation.
 * This action is documented in includes/class-myworks-woo-sync-for-xero-deactivator.php
 */
function myworks_woo_sync_for_xero_deactivate() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-myworks-woo-sync-for-xero-deactivator.php';
	MyWorks_WC_Xero_Sync_Deactivator::deactivate();
}

register_activation_hook( __FILE__, 'myworks_woo_sync_for_xero_activate' );
register_deactivation_hook( __FILE__, 'myworks_woo_sync_for_xero_deactivate' );


/**
* Admin action links
*/

function myworks_woo_sync_for_xero_links_add($links) {
	/**/
	$links[] = '<a href="' . admin_url( 'admin.php?page=myworks-wc-xero-sync-connection' ) . '">Connection</a>';
	
	$adminlinks = array(			
		'<a target="_blank" href="https://support.myworks.software/en_US/10141789949335-WooCommerce-Sync-for-Xero">Help Center</a>',
	 );
	$adminlinks[] = '';
	return array_merge( $links, $adminlinks );
}

add_filter( 'plugin_action_links_' . plugin_basename(__FILE__), 'myworks_woo_sync_for_xero_links_add' );

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require plugin_dir_path( __FILE__ ) . 'includes/class-myworks-woo-sync-for-xero.php';

/**
 * Begins execution of the plugin.
 *
 * Since everything within the plugin is registered via hooks,
 * then kicking off the plugin from this point in the file does
 * not affect the page life cycle.
 *
 * @since    1.0.0
 */
function myworks_woo_sync_for_xero_run() {

	$myworks_wc_xero_sync = new MyWorks_WC_Xero_Sync();
	$myworks_wc_xero_sync->run();

}

myworks_woo_sync_for_xero_run();

