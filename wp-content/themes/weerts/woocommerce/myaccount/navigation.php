<?php
/**
 * Account navigation with icons. Horizontal on phones, vertical card on desktop.
 *
 * @version 9.3.0
 */

defined('ABSPATH') || exit;

do_action('woocommerce_before_account_navigation');
$current_user = wp_get_current_user();
?>
<nav class="rural-account__nav woocommerce-MyAccount-navigation" aria-label="<?php esc_attr_e('Account pages', 'woocommerce'); ?>">
	<div class="rural-account__nav-user">
		<span class="rural-account__nav-avatar" aria-hidden="true"><?php echo esc_html(mb_strtoupper(mb_substr(weerts_customer_first_name($current_user), 0, 1))); ?></span>
		<span class="rural-account__nav-name">
			<strong><?php echo esc_html(trim($current_user->first_name . ' ' . $current_user->last_name) ?: $current_user->display_name); ?></strong>
			<span><?php echo esc_html($current_user->user_email); ?></span>
		</span>
	</div>
	<ul class="rural-account__nav-list">
		<?php foreach (wc_get_account_menu_items() as $endpoint => $label) : ?>
			<li class="<?php echo esc_attr(wc_get_account_menu_item_classes($endpoint)); ?> rural-account__nav-item rural-account__nav-item--<?php echo esc_attr($endpoint); ?>">
				<a href="<?php echo esc_url(wc_get_account_endpoint_url($endpoint)); ?>" <?php echo wc_is_current_account_menu_item($endpoint) ? 'aria-current="page"' : ''; ?>>
					<span class="rural-account__nav-icon"><?php echo weerts_account_icon($endpoint); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
					<span><?php echo esc_html($label); ?></span>
				</a>
			</li>
		<?php endforeach; ?>
	</ul>
</nav>
<?php do_action('woocommerce_after_account_navigation'); ?>
