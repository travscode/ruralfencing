<?php
if(!defined( 'ABSPATH' )){
	exit;
}

global $MWXS_L;
global $wpdb;

$page_url = admin_url('admin.php?page=myworks-wc-xero-sync-log');

$table = $MWXS_L->gdtn('log');

#Delete
$del_log_id = (int) $MWXS_L->var_g('del_log',0);
if($del_log_id > 0){
	$wpdb->query($wpdb->prepare("DELETE FROM `" . esc_sql($table) . "` WHERE `id` = %d",$del_log_id));
	$MWXS_L->redirect($page_url);
}

# Data Listing / Search
$MWXS_L->set_per_page_from_url();
$items_per_page = $MWXS_L->get_item_per_page();
 
$MWXS_L->set_and_get('log_search');
$log_search = $MWXS_L->get_session_val('log_search');

$log_search = $MWXS_L->sanitize($log_search);

$search_params = array();
$whr_sql = '';
if(!empty($log_search)){
	$search_like = '%' . $wpdb->esc_like($log_search) . '%';
	$whr_sql = " AND (`details` LIKE %s OR `log_type` LIKE %s OR `log_title` LIKE %s)";
	$search_params = array($search_like, $search_like, $search_like);
}

if(!empty($search_params)){
	$total_records = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM `" . esc_sql($table) . "` WHERE `id` >0 " . $whr_sql, ...$search_params)); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
} else {
	$total_records = $wpdb->get_var("SELECT COUNT(*) FROM `" . esc_sql($table) . "` WHERE `id` >0"); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
}

$page = $MWXS_L->get_page_var();
$offset = ( $page * $items_per_page ) - $items_per_page;

if(!empty($search_params)){
	$log_q = $wpdb->prepare("SELECT * FROM `" . esc_sql($table) . "` WHERE `id` >0 " . $whr_sql . " ORDER BY `id` DESC LIMIT %d, %d", ...array_merge($search_params, array($offset, $items_per_page))); // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.PreparedSQL.NotPrepared
} else {
	$log_q = $wpdb->prepare("SELECT * FROM `" . esc_sql($table) . "` WHERE `id` >0 ORDER BY `id` DESC LIMIT %d, %d", $offset, $items_per_page); // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.PreparedSQL.NotPrepared
}
$log_data = $MWXS_L->get_data($log_q);
?>

<br><br>
<div class="container log-outr-sec mq_lp_cont">
	<div class="page_title"><h4><?php esc_html_e( 'Sync Log', 'myworks-sync-for-xero' );?></h4></div>
	<div class="mw_wc_filter">
		<input placeholder="Search Log" type="text" id="log_search" value="<?php echo esc_attr($log_search);?>">
		
		<?php myworks_woo_sync_for_xero_filter_reset_show_entries_html($page_url,$items_per_page);?>
	</div>
	
	<br>
	
	<div class="mq_lp_cdt">
		<?php esc_html_e( 'Current Datetime', 'myworks-sync-for-xero' );?>: <?php echo esc_html($MWXS_L->now('Y-m-d '));?> 
		<b><?php echo esc_html($MWXS_L->now('h:i:s A'));?></b>
	</div>
	
	<br>
	
	<div class="myworks-wc-qbo-sync-table-responsive">
		<table class="wp-list-table widefat fixed striped posts  menu-blue-bg">
			<thead>
				<tr>
					<th style="text-align:center;" width="8%">#</th>
					<th width="30%">&nbsp;</th>
					<th width="40%">Message</th>
					<th width="12%">Date</th>
					<th style="text-align:center;" width="10%">Action</th>
				</tr>
			</thead>
			
			<tbody id="mwqs-log-list">
				<?php if(is_array($log_data) && !empty($log_data)):?>
				<?php foreach($log_data as $data):?>
				
				<?php 
					$is_log_error  = (!$data['status'] || $data['status'] < 1)?true:false;
					$ls_class = ($is_log_error)?' cl_err':'';
					
					$details = $MWXS_L->get_log_page_details_field_data_formatted($data);
				?>
				
				<tr>
					<td style="text-align:center;"><?php echo (int) $data['id'];?></td>
					
					<td>
						<h4 class="mq_lp_lth"><?php echo esc_html($data['log_type'])?></h4>
						<div class="mq_lp_tbd<?php echo esc_attr($ls_class);?>">
							<?php echo esc_html(stripslashes($data['log_title']));?>
						</div>
					</td>
					
					<td <?php echo ($is_log_error)?' style="color:#dd281a;"':'';?>>			
						<?php
							echo wp_kses(str_replace(
								['{LPDW_S}','{LPDX_S}','{LPDW_E}','{LPDX_E}','{LB}'],
								['<span class="lm_wid">','<span class="lm_qid">','</span>','</span>','<br>'],
								esc_html(stripcslashes($details))
							), ['span' => ['class' => []], 'br' => []]);			
						?>
					</td>
					
					<td>
						<span class="mq_lp_ltime"><?php echo esc_html(gmdate('h:i:s A',strtotime($data['added_date'])));?></span>
						<span><?php echo esc_html(gmdate('Y-m-d',strtotime($data['added_date'])));?></span>
					</td>
					
					<td style="text-align:center;">
						<a class="mwqslld_btn" title="Delete" href="javascript:void(0);" onclick="javascript:if(confirm('<?php echo esc_js(__('Are you sure, you want to delete this!','myworks-sync-for-xero'))?>')){window.location='<?php echo esc_url_raw($page_url);?>&del_log=<?php echo (int) $data['id']?>';}">x</a>						
						<?php $MWXS_L->get_log_page_view_in_xero_link($data);?>
					</td>
				</tr>
				
				<?php endforeach;?>
				<?php else:?>
				
				<tr>
					<td colspan="5">
						<span class="mwxs_tnd">
							<?php esc_html_e( 'No logs found.', 'myworks-sync-for-xero' );?>
						</span>
					</td>
				</tr>
				
				<?php endif;?>
			</tbody>
		</table>
	</div>
	<?php $MWXS_L->get_paginate_links($total_records,$items_per_page);?>
	
	<?php if($total_records > 0):?>
	<br>
	<div>
		<?php wp_nonce_field( 'myworks_wc_xero_sync_clear_all_logs', 'clear_all_logs' ); ?>
		<button id="mwqs_clear_all_logs_btn"><?php esc_html_e( 'Clear Entire Log', 'myworks-sync-for-xero' );?></button>
		&nbsp;
		<?php wp_nonce_field( 'myworks_wc_xero_sync_clear_all_log_errors', 'clear_all_log_errors' ); ?>
		<button id="mwqs_clear_all_log_errors_btn"><?php esc_html_e( 'Clear Error Logs', 'myworks-sync-for-xero' );?></button>
	</div>
	<?php endif;?>
</div>

<script type="text/javascript">
	function search_item(){
		let log_search = jQuery('#log_search').val();
		log_search = jQuery.trim(log_search);
		
		if(log_search!=''){
			window.location = '<?php echo esc_url_raw($page_url);?>&log_search='+log_search;
		}else{
			alert('<?php echo esc_js(__('Please enter search keyword.','myworks-sync-for-xero'))?>');
		}
	}
	
	function reset_item(){		
		window.location = '<?php echo esc_url_raw($page_url);?>&log_search=';
	}
	
	<?php if($total_records > 0):?>
	jQuery(document).ready(function($){		
		$('#mwqs_clear_all_logs_btn').click(function(){
			if(confirm('<?php echo esc_js(__('This will clear all log entries. OK to proceed?','myworks-sync-for-xero'))?>')){
				var data = {
					"action": 'myworks_wc_xero_sync_clear_all_logs',
					"clear_all_logs": $('#clear_all_logs').val(),
				};
				
				var btn_text = $(this).html();
				var loading_msg = 'Loading...';
				$(this).html(loading_msg);
				
				$.ajax({
				   type: "POST",
				   url: ajaxurl,
				   data: data,
				   cache:  false ,
				   //datatype: "json",
				   success: function(result){
					   $('#mwqs_clear_all_logs_btn').html(btn_text);
					   if(result!=0 && result!=''){						 
						 window.location='<?php echo esc_url_raw($page_url);?>';
					   }else{
						 alert('Error!');			 
					   }					   	
				   },
				   error: function(result) {
						$('#mwqs_clear_all_logs_btn').html(btn_text);
						alert('Error!');					
				   }
				});
			}
		});
		
		$('#mwqs_clear_all_log_errors_btn').click(function(){			
			if(confirm('<?php echo esc_js(__('This will clear all error log entries. OK to proceed?','myworks-sync-for-xero'))?>')){
				var data = {
					"action": 'myworks_wc_xero_sync_clear_all_log_errors',
					"clear_all_log_errors": $('#clear_all_log_errors').val(),
				};
				
				var btn_text = $(this).html();				
				var loading_msg = 'Loading...';
				$(this).html(loading_msg);
				
				$.ajax({
				   type: "POST",
				   url: ajaxurl,
				   data: data,
				   cache:  false ,
				   //datatype: "json",
				   success: function(result){
					    $('#mwqs_clear_all_log_errors_btn').html(btn_text);
					   if(result!=0 && result!=''){						 
						 window.location='<?php echo esc_url_raw($page_url);?>';
					   }else{
						 alert('Error!');			 
					   }				  
				   },
				   error: function(result) {
						$('#mwqs_clear_all_log_errors_btn').html(btn_text);
						alert('Error!');					
				   }
				});
			}
		});
	});
	<?php endif;?>
</script>