<?php
if ( ! defined( 'ABSPATH' ) )
exit;

# License
function myworks_wc_xero_sync_check_license(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_check_license', 'check_plugin_license' ) ) {
		// process form data
		global $MWXS_L;
		
		$mw_wc_xero_sync_localkey = get_option('mw_wc_xero_localkey','');
		$mw_wc_xero_sync_localkey = $MWXS_L->sanitize($mw_wc_xero_sync_localkey);
		
		$mw_wc_xero_sync_license =  $MWXS_L->var_p('mw_wc_xero_license');	
		
		if($mw_wc_xero_sync_license!=$MWXS_L->get_option('mw_wc_xero_license')){
			#$MWXS_L->initialize_session();
			#$MWXS_L->set_session_val('new_license_check',1);
		}		
		
		if($MWXS_L->is_valid_license($mw_wc_xero_sync_license,$mw_wc_xero_sync_localkey,true)){
			echo 'License Activated';
		}else{
			echo 'Invalid License key';
		}		
	}
	wp_die();
}

function myworks_wc_xero_sync_del_license_local_key(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_del_license_local_key', 'del_license_local_key' ) ) {
		delete_option('mw_wc_xero_localkey');
		echo 'Success';
	}	
	wp_die();
}

# Dashboard Graph
function myworks_wc_xero_sync_refresh_log_chart(){
	global $MWXS_L;
	$vp = $MWXS_L->var_p('period');
	
	$MWXS_L->initialize_session();
	$MWXS_L->set_session_val('dashboard_graph_period',$vp);
	require_once('admin-page-hcj-functions.php');
	myworks_woo_sync_for_xero_get_log_chart_output($vp);	
	wp_die();
}

# Connection Key
function myworks_wc_xero_sync_save_xero_c_key(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_save_xero_c_key', 'save_xero_c_key' ) ) {
		global $MWXS_L;		
		$f_xc_key = $MWXS_L->var_p('f_xc_key');
		
		if(!empty($f_xc_key)){			
			if(strlen($f_xc_key) == '35' && $MWXS_L->validate_connection_key($f_xc_key)){
				$MWXS_L->update_option('mw_wc_xero_f_xc_key',$f_xc_key);
				echo '<br><span style="color:green;">Connection key saved</span>';
			}			
		}
	}
	wp_die();
}

# Quick Refresh
function myworks_wc_xero_sync_quick_refresh_cp(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_quick_refresh_cp', 'quick_refresh_cp' ) ) {
		global $MWXS_L;
		
		if(!$MWXS_L->is_xero_connected()){$MWXS_L->xero_connect();}
		
		if($MWXS_L->is_xero_connected()){
			$tci = (int) $MWXS_L->xero_refresh_customers();
			$tpi = (int) $MWXS_L->xero_refresh_products();
			
			# Clear Invalid Mappings
			if($tci > 0){
				$MWXS_L->clear_customer_invalid_mappings();
			}
			
			if($tpi > 0){
				$MWXS_L->clear_product_invalid_mappings();
				$MWXS_L->clear_variation_invalid_mappings();
			}			
			
			// Security: Use WordPress escaping functions directly
			echo '<br>Total Customer Imported: <b>' . esc_html($tci) . '</b><br>';
			echo 'Total Product Imported: <b>' . esc_html($tpi) . '</b>';			
			
		}else{
			echo '<br><span style="color:red;">Xero connection problem</span>';
		}
	}
	wp_die();
}

function myworks_wc_xero_sync_quick_refresh_customers(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_quick_refresh_customers', 'quick_refresh_customers' ) ) {
		global $MWXS_L;
		
		if(!$MWXS_L->is_xero_connected()){$MWXS_L->xero_connect();}
		
		if($MWXS_L->is_xero_connected()){
			$tci = (int) $MWXS_L->xero_refresh_customers();
			
			# Clear Invalid Mappings
			if($tci > 0){
				$MWXS_L->clear_customer_invalid_mappings();
			}
			
			echo 'Total Customer Imported: <b>'.esc_html($tci).'</b>';
			
		}else{
			echo '<font style="color:red;">Xero connection problem</font>';
		}
	}
	wp_die();
}

function myworks_wc_xero_sync_quick_refresh_products(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_quick_refresh_products', 'quick_refresh_products' ) ) {
		global $MWXS_L;
		
		if(!$MWXS_L->is_xero_connected()){$MWXS_L->xero_connect();}
		
		if($MWXS_L->is_xero_connected()){			
			$tpi = (int) $MWXS_L->xero_refresh_products();
			
			# Clear Invalid Mappings
			if($tpi > 0){
				$MWXS_L->clear_product_invalid_mappings();
				$MWXS_L->clear_variation_invalid_mappings();
			}
			
			echo 'Total Product Imported: <b>'.esc_html($tpi).'</b>';
			
		}else{
			echo '<font style="color:red;">Xero connection problem</font>';
		}
	}
	wp_die();
}

# Clear Mappings
function myworks_wc_xero_sync_clear_all_mappings(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_all_mappings', 'clear_all_mappings' ) ) {
		global $MWXS_L;
		global $wpdb;		
		
		// Security: Use prepared statements and validate table names
		$table_customers = $MWXS_L->get_validated_table_name('map_customers');
		$table_products = $MWXS_L->get_validated_table_name('map_products'); 
		$table_payment_method = $MWXS_L->get_validated_table_name('map_payment_method');
		$table_tax = $MWXS_L->get_validated_table_name('map_tax');
		
		// Clear customers mapping
		if ($table_customers) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_customers) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_customers) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		
		// Clear products mapping  
		if ($table_products) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_products) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_products) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		
		// Clear payment method mapping
		if ($table_payment_method) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_payment_method) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_payment_method) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		
		// Clear tax mapping
		if ($table_tax) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_tax) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_tax) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		
		// Clear multiple mapping
		$table_multiple = $MWXS_L->get_validated_table_name('map_multiple');
		if ($table_multiple) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_multiple) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_multiple) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		
		echo 'Success';
	}
	wp_die();
}

function myworks_wc_xero_sync_clear_customer_mappings(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_customer_mappings', 'clear_customer_mappings' ) ) {
		global $MWXS_L;
		global $wpdb;
		
		// Security: Use validated table name
		$table = $MWXS_L->get_validated_table_name('map_customers');
		
		if ($table) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}
	wp_die();
}

function myworks_wc_xero_sync_clear_product_mappings(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_product_mappings', 'clear_product_mappings' ) ) {
		global $MWXS_L;
		global $wpdb;
		
		// Security: Use validated table names
		$table_products = $MWXS_L->get_validated_table_name('map_products');
		$table_multiple = $MWXS_L->get_validated_table_name('map_multiple');
		
		if ($table_products && $table_multiple) {
			// Clear products mapping
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_products) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_products) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

			// Clear account mappings for products
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_multiple) . "` WHERE `wc_type` = %s AND `x_type` = %s", 'product', 'account')); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			
			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}
	wp_die();
}

function myworks_wc_xero_sync_clear_variation_mappings(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_variation_mappings', 'clear_variation_mappings' ) ) {
		global $MWXS_L;
		global $wpdb;
		
		// Security: Use validated table names
		$table_variations = $MWXS_L->get_validated_table_name('map_variations');
		$table_multiple = $MWXS_L->get_validated_table_name('map_multiple');
		
		if ($table_variations && $table_multiple) {
			// Clear variations mapping
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_variations) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table_variations) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			
			// Clear account mappings for variations
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table_multiple) . "` WHERE `wc_type` = %s AND `x_type` = %s", 'variation', 'account')); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}
	wp_die();
}

# Clear Logs
function myworks_wc_xero_sync_clear_all_logs(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_all_logs', 'clear_all_logs' ) ) {
		global $MWXS_L;
		global $wpdb;

		// Security: Use validated table name
		$table = $MWXS_L->get_validated_table_name('log');
		
		if ($table) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}	
	wp_die();
}

function myworks_wc_xero_sync_clear_all_log_errors(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_all_log_errors', 'clear_all_log_errors' ) ) {
		global $MWXS_L;
		global $wpdb;
		
		// Security: Use validated table name
		$table = $MWXS_L->get_validated_table_name('log');
		
		if ($table) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table) . "` WHERE `status` = %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}	
	wp_die();
}

# Clear Queue
function myworks_wc_xero_sync_clear_all_pending_queues(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_all_pending_queues', 'clear_all_pending_queues' ) ) {
		global $MWXS_L;
		global $wpdb;
		
		// Security: Use validated table name
		$table = $MWXS_L->get_validated_table_name('queue');
		
		if ($table) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table) . "` WHERE `run` = %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}	
	wp_die();
}

function myworks_wc_xero_sync_clear_all_queues(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_clear_all_queues', 'clear_all_queues' ) ) {
		global $MWXS_L;
		global $wpdb;
		
		// Security: Use validated table name
		$table = $MWXS_L->get_validated_table_name('queue');
		
		if ($table) {
			$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table) . "` WHERE `id` > %d", 0)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query("TRUNCATE TABLE `" . esc_sql($table) . "`"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			echo 'Success';
		} else {
			echo 'Error: Invalid table access';
		}
	}	
	wp_die();
}

# Auto Map
function myworks_wc_xero_sync_automap_customers_wf_xf(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_automap_customers_wf_xf', 'automap_customers_wf_xf' ) ) {
		global $MWXS_L;
		
		$cam_wf = $MWXS_L->var_p('cam_wf');		
		$cam_qf = $MWXS_L->var_p('cam_qf');		
		
		$mo_um = false;
		if(isset($_POST['mo_um']) && $_POST['mo_um'] == 'true'){
			$mo_um = true;
		}
		
		$map_count = (int) $MWXS_L->AutoMapCustomers($cam_wf,$cam_qf,$mo_um);
		
		echo 'Total Customer Mapped: '.esc_html($map_count);
	}
	wp_die();
}

function myworks_wc_xero_sync_automap_products_wf_xf(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_automap_products_wf_xf', 'automap_products_wf_xf' ) ) {
		global $MWXS_L;		
		
		$pam_wf = $MWXS_L->var_p('pam_wf');		
		$pam_qf = $MWXS_L->var_p('pam_qf');
		
		$mo_um = false;
		if(isset($_POST['mo_um']) && $_POST['mo_um'] == 'true'){
			$mo_um = true;
		}
		
		$map_count = (int) $MWXS_L->AutoMapProducts($pam_wf,$pam_qf,$mo_um);
		
		echo 'Total Product Mapped: '.esc_html($map_count);
	}	
	wp_die();
}

function myworks_wc_xero_sync_automap_variations_wf_xf(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_automap_variations_wf_xf', 'automap_variations_wf_xf' ) ) {
		global $MWXS_L;		
		
		$vam_wf = $MWXS_L->var_p('vam_wf');		
		$vam_qf = $MWXS_L->var_p('vam_qf');
		
		$mo_um = false;
		if(isset($_POST['mo_um']) && $_POST['mo_um'] == 'true'){
			$mo_um = true;
		}
		
		$map_count = (int) $MWXS_L->AutoMapVariations($vam_wf,$vam_qf,$mo_um);
		
		echo 'Total Variation Mapped: '.esc_html($map_count);
	}	
	wp_die();
}

function myworks_wc_xero_sync_window(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_window', 'window_xero_sync' ) ) {
		global $MWXS_L;
		global $MWXS_A;
		
		$sync_type = $MWXS_L->var_p('sync_type');
		$item_type = $MWXS_L->var_p('item_type');
		if($sync_type == 'pull'){
			$id = $MWXS_L->var_p('id');
		}else{
			$id = (int) $MWXS_L->var_p('id');
		}
		
		$cur_item = (int) $MWXS_L->var_p('cur_item');
		$tot_item = (int ) $MWXS_L->var_p('tot_item');
		
		$check_sync_valid = true;
		
		if($sync_type!='push' && $sync_type!='pull'){
			$check_sync_valid = false;
		}
		
		if($item_type!='customer' && $item_type!='order' && $item_type!='product' && $item_type!='variation'){
			$check_sync_valid = false;
		}
		
		if(($sync_type != 'pull' && $id < 1) || ($sync_type == 'pull' && empty($id)) || !$cur_item || !$tot_item){
			$check_sync_valid = false;
		}
		
		if($check_sync_valid){
			try{
				$key =  $cur_item;		  
				$per = $key/$tot_item*100;
				$per = ceil($per);			
				$msg = "<span class='error_red'>Something went wrong.</span>";
				$sync_status = 0;
				
				if($sync_type=='push'){
					if($item_type=='customer'){				
						$r = $MWXS_A->hook_user_register(array('user_id'=>$id,'f_p_p'=>true));
						if($r){
							$msg = "<span class='success_green'>Customer #".esc_html($id)." has been pushed into Xero</span>";
						}else{
							$msg = "<span class='error_red'>There was an error pushing customer #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
						}						
					}
					
					if($item_type=='product'){						
						$r = $MWXS_A->hook_product_add(array('product_id'=>$id,'f_p_p'=>true));
						if(is_array($r)){
							$is_update = (isset($r['update']) && $r['update'] === 1)?true:false;
							$r_id = '';
							if(isset($r['sync_status']) && $r['sync_status'] === 1){
								$sync_status = 1;
								$r_id = (isset($r['x_id']))?$r['x_id']:'';
							}

							if($sync_status === 1){
								if($is_update){
									$msg = "<span class='success_green'>Product #".esc_html($id)." has been updated into Xero</span>";
								}else{
									$msg = "<span class='success_green'>Product #".esc_html($id)." has been pushed into Xero</span>";
								}
							}else{
								if($is_update){
									if(isset($r['msgs']) && !empty($r['msgs'])){
										$msg = "<span class='error_red'>There was an error updating product #".esc_html($id)." - ".esc_html($r['msgs'][0])."</span>";
									}else{
										$msg = "<span class='error_red'>There was an error updating product #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
									}
								}else{
									if(isset($r['msgs']) && !empty($r['msgs'])){
										$msg = "<span class='error_red'>There was an error pushing product #".esc_html($id)." - ".esc_html($r['msgs'][0])."</span>";
									}else{
										$msg = "<span class='error_red'>There was an error pushing product #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
									}
								}								
							}
						}else{
							if($r){
								$msg = "<span class='success_green'>Product #".esc_html($id)." has been pushed into Xero</span>";
							}else{
								$msg = "<span class='error_red'>There was an error pushing product #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
							}
						}												
					}
					
					if($item_type=='variation'){
						$r = $MWXS_A->hook_variation_add(array('variation_id'=>$id,'f_p_p'=>true));
						if(is_array($r)){
							$is_update = (isset($r['update']) && $r['update'] === 1)?true:false;
							$r_id = '';
							if(isset($r['sync_status']) && $r['sync_status'] === 1){
								$sync_status = 1;
								$r_id = (isset($r['x_id']))?$r['x_id']:'';
							}

							if($sync_status === 1){
								if($is_update){
									$msg = "<span class='success_green'>Variation #".esc_html($id)." has been updated into Xero</span>";
								}else{
									$msg = "<span class='success_green'>Variation #".esc_html($id)." has been pushed into Xero</span>";
								}
							}else{
								if($is_update){
									if(isset($r['msgs']) && !empty($r['msgs'])){
										$msg = "<span class='error_red'>There was an error updating variation #".esc_html($id)." - ".esc_html($r['msgs'][0])."</span>";
									}else{
										$msg = "<span class='error_red'>There was an error updating variation #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
									}
								}else{
									if(isset($r['msgs']) && !empty($r['msgs'])){
										$msg = "<span class='error_red'>There was an error pushing variation #".esc_html($id)." - ".esc_html($r['msgs'][0])."</span>";
									}else{
										$msg = "<span class='error_red'>There was an error pushing variation #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
									}
								}								
							}
						}else{
							if($r){
								$msg = "<span class='success_green'>Variation #".esc_html($id)." has been pushed into Xero</span>";
							}else{
								$msg = "<span class='error_red'>There was an error pushing variation #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
							}
						}												
					}
					
					if($item_type=='order'){
						$r = $MWXS_A->hook_order_add(array('order_id'=>$id,'f_p_p'=>true));
						if($r){
							$msg = "<span class='success_green'>Order #".esc_html($id)." has been pushed into Xero</span>";
						}else{
							$msg = "<span class='error_red'>There was an error pushing order #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
						}						
					}
				}
				
				if($sync_type=='pull'){
					$MWXS_L->xero_connect();
					if($item_type=='product'){						
						$r = $MWXS_L->X_Pull_Product_By_Id($id);
						if($r){
							$msg = "<span class='success_green'>Product #".esc_html($id)." has been pulled into WooCommerce</span>";
						}else{
							$msg = "<span class='error_red'>There was an error pulling product #".esc_html($id)." , Check MyWorks Sync > Log for additional details.</span>";
						}
					}
				}
				
				$MWXS_L->show_sync_window_message($key, $msg , $per, $tot_item);
				
			}catch (Exception $e) {
				$Exception = $e->getMessage();
			}
		}
	}
	wp_die();
}

function myworks_wc_xero_sync_order_sync_status_list(){
	if ( ! empty( $_POST ) && check_admin_referer( 'myworks_wc_xero_sync_order_sync_status_list', 'order_sync_status_list' ) ) {
		global $MWXS_L;		
		$order_id_num_arr = $MWXS_L->var_p('order_id_num_arr');
		if(is_array($order_id_num_arr) && !empty($order_id_num_arr)){
			$MWXS_L->xero_connect();
			$order_id_num_arr = $MWXS_L->get_order_sync_status_list($order_id_num_arr);

			if(empty($order_id_num_arr)){
				$order_id_num_arr = array_fill_keys(array_keys($order_id_num_arr), null);
			}			
		}
		
		#$MWXS_L->_p($order_id_num_arr);		
		echo json_encode($order_id_num_arr);
	}
	wp_die();
}

function myworks_wc_xero_sync_order_invoice_pdf() {
	global $MWXS_L;

    if (!current_user_can('manage_woocommerce')) {
        wp_die('Unauthorized', '', ['response' => 403]);
    }

    check_admin_referer('view_xero_invoice_pdf');

    $invoice_id = sanitize_text_field($_GET['invoice_id'] ?? '');
    if (!$invoice_id) {
        wp_die('Missing Invoice ID', '', ['response' => 400]);
    }

	$MWXS_L->xero_connect();

    $access_token = $MWXS_L->get_xero_access_token();
    $tenant_id    = $MWXS_L->get_xero_tenant_id();

    if (empty($access_token) || empty($tenant_id)) {
        wp_die('Missing Xero Authorization Details', '', ['response' => 400]);
    }

    $url = "https://api.xero.com/api.xro/2.0/Invoices/$invoice_id";

    $args = array(
        'headers' => array(
            'Authorization' => "Bearer {$access_token}",
            'Xero-tenant-id' => $tenant_id,
            'Accept' => 'application/pdf',
        ),
        'timeout' => 30,
        'sslverify' => true,
    );

    $response = wp_remote_get($url, $args);
    
    if (is_wp_error($response)) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		wp_die('Failed to fetch invoice PDF: ' . esc_html($response->get_error_message()), '', ['response' => 500]); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    $http_code = wp_remote_retrieve_response_code($response);
    $pdf = wp_remote_retrieve_body($response);

    if ($http_code !== 200 || empty($pdf)) {
        wp_die('Failed to fetch invoice PDF', '', ['response' => 500]);
    }

    // Validate that the content is actually a PDF file
    if (substr($pdf, 0, 4) !== '%PDF') {
        wp_die('Invalid PDF content received from Xero', '', ['response' => 500]);
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="xero-invoice.pdf"');
    header('Content-Length: ' . strlen($pdf));

    echo $pdf; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Binary PDF content cannot be escaped
    exit;
}
