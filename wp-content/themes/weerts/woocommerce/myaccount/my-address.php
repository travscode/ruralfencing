<?php
/**
 * Saved addresses as cards.
 *
 * @version 9.3.0
 */

defined('ABSPATH') || exit;

$customer_id = get_current_user_id();
$ship_separately = !wc_ship_to_billing_address_only() && wc_shipping_enabled();
$get_addresses = apply_filters(
	'woocommerce_my_account_get_addresses',
	$ship_separately
		? ['billing' => 'Billing address', 'shipping' => 'Delivery address']
		: ['billing' => 'Billing address'],
	$customer_id
);
?>
<header class="rural-account__page-head">
	<h2 class="rural-account__title">Addresses</h2>
	<p class="rural-account__muted"><?php echo esc_html(apply_filters('woocommerce_my_account_my_address_description', 'These fill in automatically at checkout. You can still change them for any single order.')); ?></p>
</header>

<div class="rural-account__grid woocommerce-Addresses">
	<?php foreach ($get_addresses as $name => $address_title) :
		$address = wc_get_account_formatted_address($name); ?>
		<section class="rural-account__card woocommerce-Address" aria-labelledby="rural-address-<?php echo esc_attr($name); ?>">
			<div class="rural-account__card-head">
				<h3 id="rural-address-<?php echo esc_attr($name); ?>"><?php echo esc_html($address_title); ?></h3>
				<a class="rural-account__link edit" href="<?php echo esc_url(wc_get_endpoint_url('edit-address', $name)); ?>"><?php echo $address ? 'Edit' : 'Add'; ?></a>
			</div>
			<?php if ($address) : ?>
				<address class="rural-account__address"><?php echo wp_kses_post($address); ?></address>
			<?php else : ?>
				<p class="rural-account__muted">Not saved yet.</p>
				<?php echo weerts_account_button('Add ' . strtolower($address_title), wc_get_endpoint_url('edit-address', $name)); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			<?php endif; ?>
			<?php do_action('woocommerce_my_account_after_my_address', $name); ?>
		</section>
	<?php endforeach; ?>
</div>
