<?php
/**
 * Edit one address.
 *
 * @version 9.3.0
 */

defined('ABSPATH') || exit;

$page_title = ('billing' === $load_address) ? 'Billing address' : 'Delivery address';

do_action('woocommerce_before_edit_account_address_form'); ?>

<?php if (!$load_address) : ?>
	<?php wc_get_template('myaccount/my-address.php'); ?>
<?php else : ?>
	<a class="rural-account__back" href="<?php echo esc_url(wc_get_account_endpoint_url('edit-address')); ?>">‹ Addresses</a>
	<header class="rural-account__page-head">
		<h2 class="rural-account__title"><?php echo esc_html(apply_filters('woocommerce_my_account_edit_address_title', $page_title, $load_address)); ?></h2>
	</header>

	<form class="rural-account__card rural-account__form" method="post" novalidate>
		<div class="woocommerce-address-fields">
			<?php do_action("woocommerce_before_edit_address_form_{$load_address}"); ?>
			<div class="woocommerce-address-fields__field-wrapper">
				<?php
				foreach ($address as $key => $field) {
					woocommerce_form_field($key, $field, wc_get_post_data_by_key($key, $field['value']));
				}
				?>
			</div>
			<?php do_action("woocommerce_after_edit_address_form_{$load_address}"); ?>
			<div class="rural-account__form-actions">
				<button type="submit" class="rural-button rural-button--submit" name="save_address" value="Save address"><span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 6h9.5M6.5 2l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></span><span>Save address</span></button>
				<?php wp_nonce_field('woocommerce-edit_address', 'woocommerce-edit-address-nonce'); ?>
				<input type="hidden" name="action" value="edit_address" />
			</div>
		</div>
	</form>
<?php endif; ?>

<?php do_action('woocommerce_after_edit_account_address_form'); ?>
