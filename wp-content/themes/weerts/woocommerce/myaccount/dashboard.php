<?php
/**
 * Account overview: recent orders, details, delivery address and help.
 *
 * @version 4.4.0
 */

defined('ABSPATH') || exit;

$customer = new WC_Customer($current_user->ID);
$first_name = weerts_customer_first_name($current_user);
$recent_orders = wc_get_orders([
	'customer_id' => $current_user->ID,
	'limit' => 3,
	'orderby' => 'date',
	'order' => 'DESC',
	'status' => array_keys(wc_get_order_statuses()),
]);
$order_count = wc_get_customer_order_count($current_user->ID);
$shipping_address = wc_get_account_formatted_address('shipping');
$billing_address = wc_get_account_formatted_address('billing');
$address_html = $shipping_address ?: $billing_address;
$address_kind = $shipping_address ? 'shipping' : 'billing';
$phone = $customer->get_billing_phone();
?>
<header class="rural-account__hello">
	<h2 class="rural-account__title">Hi <?php echo esc_html($first_name); ?></h2>
	<p>
		<?php if ($order_count) : ?>
			Here is what is happening with your account.
		<?php else : ?>
			Welcome. Your orders, addresses and details all live here.
		<?php endif; ?>
		<span class="rural-account__hello-logout">Not <?php echo esc_html($first_name); ?>? <a href="<?php echo esc_url(wc_logout_url()); ?>">Log out</a></span>
	</p>
</header>

<div class="rural-account__grid">
	<section class="rural-account__card rural-account__card--wide" aria-labelledby="rural-recent-orders">
		<div class="rural-account__card-head">
			<h3 id="rural-recent-orders">Recent orders</h3>
			<?php if ($order_count > 3) : ?>
				<a class="rural-account__link" href="<?php echo esc_url(wc_get_account_endpoint_url('orders')); ?>">View all <?php echo (int) $order_count; ?> orders</a>
			<?php elseif ($order_count) : ?>
				<a class="rural-account__link" href="<?php echo esc_url(wc_get_account_endpoint_url('orders')); ?>">View all orders</a>
			<?php endif; ?>
		</div>

		<?php if ($recent_orders) : ?>
			<ul class="rural-order-rows">
				<?php foreach ($recent_orders as $order) :
					$thumbs = weerts_order_item_thumbs($order, 1); ?>
					<li>
						<a class="rural-order-row" href="<?php echo esc_url($order->get_view_order_url()); ?>">
							<span class="rural-order-row__thumb"><?php echo $thumbs['thumbs'][0] ?? ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
							<span class="rural-order-row__body">
								<span class="rural-order-row__title">Order #<?php echo esc_html($order->get_order_number()); ?></span>
								<span class="rural-order-row__meta"><?php echo esc_html(wc_format_datetime($order->get_date_created(), 'j M Y')); ?> · <?php echo (int) $thumbs['count']; ?> <?php echo $thumbs['count'] === 1 ? 'item' : 'items'; ?> · <?php echo wp_kses_post($order->get_formatted_order_total()); ?></span>
							</span>
							<?php echo weerts_order_status_chip_html($order); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
							<span class="rural-order-row__chevron" aria-hidden="true">›</span>
						</a>
					</li>
				<?php endforeach; ?>
			</ul>
		<?php else : ?>
			<div class="rural-account__empty">
				<p><strong>No orders yet.</strong> When you place an order it will show up here, with its status and everything you bought.</p>
				<?php echo weerts_account_button('Browse products', wc_get_page_permalink('shop')); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			</div>
		<?php endif; ?>
	</section>

	<section class="rural-account__card" aria-labelledby="rural-your-details">
		<div class="rural-account__card-head">
			<h3 id="rural-your-details">Your details</h3>
			<a class="rural-account__link" href="<?php echo esc_url(wc_get_account_endpoint_url('edit-account')); ?>">Edit</a>
		</div>
		<dl class="rural-account__dl">
			<div><dt>Name</dt><dd><?php echo esc_html(trim($current_user->first_name . ' ' . $current_user->last_name) ?: $current_user->display_name); ?></dd></div>
			<div><dt>Email</dt><dd><?php echo esc_html($current_user->user_email); ?></dd></div>
			<div><dt>Phone</dt><dd><?php echo $phone ? esc_html($phone) : '<a class="rural-account__link" href="' . esc_url(wc_get_endpoint_url('edit-address', 'billing')) . '">Add a phone number</a>'; ?></dd></div>
		</dl>
	</section>

	<section class="rural-account__card" aria-labelledby="rural-delivery-address">
		<div class="rural-account__card-head">
			<h3 id="rural-delivery-address"><?php echo $address_kind === 'shipping' ? 'Delivery address' : 'Billing address'; ?></h3>
			<a class="rural-account__link" href="<?php echo esc_url(wc_get_account_endpoint_url('edit-address')); ?>"><?php echo $address_html ? 'Edit' : 'Add'; ?></a>
		</div>
		<?php if ($address_html) : ?>
			<address class="rural-account__address"><?php echo wp_kses_post($address_html); ?></address>
		<?php else : ?>
			<p class="rural-account__muted">Save an address and checkout will fill it in for you next time.</p>
		<?php endif; ?>
	</section>

	<section class="rural-account__card rural-account__card--help rural-account__card--wide" aria-labelledby="rural-help">
		<div class="rural-account__help-body">
			<h3 id="rural-help">Need a hand with an order?</h3>
			<p>Talk to the team in Maddington. Monday to Friday 7:30am to 4:30pm, Saturday 8am to 1pm.</p>
		</div>
		<div class="rural-account__help-actions">
			<a class="rural-button" href="tel:1800010319"><span><?php echo Timber\Timber::compile('icons/phone.twig', ['class' => 'h-4 w-4']); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span><span>1800 010 319</span></a>
			<a class="rural-account__btn rural-account__btn--ghost" href="<?php echo esc_url(home_url('/contact/')); ?>">Send a message</a>
		</div>
	</section>
</div>

<?php
do_action('woocommerce_account_dashboard');
do_action('woocommerce_before_my_account');
do_action('woocommerce_after_my_account');
