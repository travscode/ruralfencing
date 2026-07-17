<?php
// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

class MyWorks_WC_Xero_Sync_P_Config{
	public $plugin_data;
	public function __construct() {
		$this->mwxs_define_constants();
	}
	
	private function mwxs_define($name, $value) {
		if(!empty($name) && !defined($name)){
			define($name, $value);
		}
	}
	
	private function mwxs_define_constants(){
		global $wpdb;
		
		if (!function_exists('get_plugin_data')) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		
		$p_dir_name = 'myworks-sync-for-xero';
		$plugin_data = get_plugin_data( dirname( __FILE__ ) . '/'.$p_dir_name.'.php' );		
		
		$this->mwxs_define('MW_WC_XERO_SYNC_P_DIR_P', plugin_dir_path( __FILE__ ));
		$this->mwxs_define('MW_WC_XERO_SYNC_P_DIR_U', plugin_dir_url( __FILE__ ));
		$this->mwxs_define('MW_WC_XERO_SYNC_PLUGIN_NAME', $p_dir_name);
		
		$this->mwxs_define('MW_WC_XERO_SYNC_PLUGIN_DB_TABLE_PREFIX', $wpdb->prefix.'mw_wc_xero_sync_');
		
		// Security: Define licensing secret key constant
		// TODO: Move this to wp-config.php or environment variable for production
		$this->mwxs_define('MW_WC_XERO_SYNC_LICENSING_SECRET_KEY', 'XF9CY3KSP3XA8H');
		
		if(is_array($plugin_data) && !empty($plugin_data)){			
			$this->mwxs_define('MW_WC_XERO_SYNC_PLUGIN_TITLE', $plugin_data['Name']);
			
			$this->mwxs_define('MW_WC_XERO_SYNC_PLUGIN_VERSION', $plugin_data['Version']);
			$this->mwxs_define('MW_WC_XERO_SYNC_PLUGIN_TEXT_DOMAIN', $plugin_data['TextDomain']);
			
			#$this->mwxs_define('MW_WC_XERO_SYNC_PLUGIN_DATA',$plugin_data);
			#const MW_WC_XERO_SYNC_PLUGIN_DATA = $plugin_data;
			
			#$this->plugin_data = $plugin_data;
		}
	}
	
	/**
	 * Decrypt license key (placeholder for proper encryption implementation)
	 * 
	 * @param string $encrypted_key The encrypted key
	 * @return string The decrypted key
	 */
	private function decrypt_license_key($encrypted_key) {
		// TODO: Implement proper decryption using WordPress salts or OpenSSL
		// For now, just return the "encrypted" value (assuming it's base64 encoded)
		$decoded = base64_decode($encrypted_key);
		return $decoded !== false ? $decoded : $encrypted_key;
	}
	
}

new MyWorks_WC_Xero_Sync_P_Config();