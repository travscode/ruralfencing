<?php
/**
 * Orders as cards: what was bought, where it is up to, what to do next.
 *
 * @version 9.5.0
 */

defined('ABSPATH') || exit;

do_action('woocommerce_before_account_orders', $has_orders);
$total_orders = wc_get_customer_order_count(get_current_user_id());
?>
<header class="rural-account__page-head">
	<h2 class="rural-account__title">Your orders</h2>
	<?php if ($has_orders) : ?>
		<p class="rural-account__muted"><?php echo (int) $total_orders; ?> <?php echo $total_orders === 1 ? 'order' : 'orders'; ?></p>
	<?php endif; ?>
</header>

<?php if ($has_orders) : ?>
	<ul class="rural-order-cards">
		<?php foreach ($customer_orders->orders as $customer_order) :
			$order = wc_get_order($customer_order); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
			if (!$order) {
				continue;
			}
			$thumbs = weerts_order_item_thumbs($order, 3);
			$actions = wc_get_account_orders_actions($order);
			unset($actions['view']);
			$pickup = $order->has_shipping_method('local_pickup') || $order->has_shipping_method('pickup_location');
			?>
			<li class="rural-order-card rural-order-card--<?php echo esc_attr($order->get_status()); ?>">
				<div class="rural-order-card__head">
					<div>
						<h3 class="rural-order-card__title">Order #<?php echo esc_html($order->get_order_number()); ?></h3>
						<p class="rural-order-card__date">Placed <?php echo esc_html(wc_format_datetime($order->get_date_created(), 'j M Y')); ?></p>
					</div>
					<?php echo weerts_order_status_chip_html($order); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</div>

				<a class="rural-order-card__items" href="<?php echo esc_url($order->get_view_order_url()); ?>" aria-label="View order <?php echo esc_attr($order->get_order_number()); ?>">
					<span class="rural-order-card__thumbs">
						<?php foreach ($thumbs['thumbs'] as $thumb) : ?>
							<span class="rural-order-card__thumb"><?php echo $thumb; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
						<?php endforeach; ?>
						<?php if ($thumbs['more'] > 0) : ?>
							<span class="rural-order-card__thumb rural-order-card__thumb--more">+<?php echo (int) $thumbs['more']; ?></span>
						<?php endif; ?>
					</span>
					<span class="rural-order-card__summary">
						<strong><?php echo (int) $thumbs['count']; ?> <?php echo $thumbs['count'] === 1 ? 'item' : 'items'; ?></strong>
						<span><?php echo wp_kses_post($order->get_formatted_order_total()); ?> · <?php echo $pickup ? 'Pickup' : 'Delivery'; ?></span>
					</span>
				</a>

				<div class="rural-order-card__actions">
					<?php echo weerts_account_button('View order', $order->get_view_order_url()); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					<?php foreach ($actions as $key => $action) : ?>
						<a class="rural-account__btn rural-account__btn--ghost rural-account__btn--<?php echo esc_attr($key); ?>" href="<?php echo esc_url($action['url']); ?>"><?php echo esc_html($action['name']); ?></a>
					<?php endforeach; ?>
				</div>
			</li>
		<?php endforeach; ?>
	</ul>

	<?php do_action('woocommerce_before_account_orders_pagination'); ?>

	<?php if (1 < $customer_orders->max_num_pages) : ?>
		<nav class="rural-account__pager" aria-label="Orders pages">
			<?php if (1 !== $current_page) : ?>
				<a class="rural-account__btn rural-account__btn--ghost" href="<?php echo esc_url(wc_get_endpoint_url('orders', $current_page - 1)); ?>">‹ Newer</a>
			<?php else : ?>
				<span></span>
			<?php endif; ?>
			<span class="rural-account__muted">Page <?php echo (int) $current_page; ?> of <?php echo (int) $customer_orders->max_num_pages; ?></span>
			<?php if (intval($customer_orders->max_num_pages) !== $current_page) : ?>
				<a class="rural-account__btn rural-account__btn--ghost" href="<?php echo esc_url(wc_get_endpoint_url('orders', $current_page + 1)); ?>">Older ›</a>
			<?php else : ?>
				<span></span>
			<?php endif; ?>
		</nav>
	<?php endif; ?>

<?php else : ?>
	<div class="rural-account__card rural-account__empty">
		<p><strong>You have not placed an order yet.</strong> Once you do, every order will be listed here with its status, the items in it and the delivery address.</p>
		<?php echo weerts_account_button('Browse products', apply_filters('woocommerce_return_to_shop_redirect', wc_get_page_permalink('shop'))); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	</div>
<?php endif; ?>

<?php do_action('woocommerce_after_account_orders', $has_orders); ?>
