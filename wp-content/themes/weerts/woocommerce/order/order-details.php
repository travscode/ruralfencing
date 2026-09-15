<?php
/**
 * Order details: items as a list with images, then totals, then addresses.
 * Used on the account "view order" page and the thank-you page.
 *
 * @version 9.9.0
 */

defined('ABSPATH') || exit;

$order = wc_get_order($order_id); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
if (!$order) {
	return;
}

$order_items = $order->get_items(apply_filters('woocommerce_purchase_order_item_types', 'line_item'));
$show_purchase_note = $order->has_status(apply_filters('woocommerce_purchase_note_order_statuses', ['completed', 'processing']));
$show_customer_details = $order->get_user_id() === get_current_user_id();
$item_count = count($order_items);
?>
<section class="rural-account__card woocommerce-order-details">
	<?php do_action('woocommerce_order_details_before_order_table', $order); ?>
	<div class="rural-account__card-head">
		<h3 class="woocommerce-order-details__title"><?php echo (int) $item_count; ?> <?php echo $item_count === 1 ? 'item' : 'items'; ?></h3>
	</div>

	<ul class="rural-order-items">
		<?php
		do_action('woocommerce_order_details_before_order_table_items', $order);
		foreach ($order_items as $item_id => $item) {
			$product = $item->get_product();
			wc_get_template(
				'order/order-details-item.php',
				[
					'order' => $order,
					'item_id' => $item_id,
					'item' => $item,
					'show_purchase_note' => $show_purchase_note,
					'purchase_note' => $product ? $product->get_purchase_note() : '',
					'product' => $product,
				]
			);
		}
		do_action('woocommerce_order_details_after_order_table_items', $order);
		?>
	</ul>

	<dl class="rural-order-totals">
		<?php foreach ($order->get_order_item_totals() as $key => $total) : ?>
			<div class="rural-order-totals__row rural-order-totals__row--<?php echo esc_attr($key); ?>">
				<dt><?php echo esc_html($total['label']); ?></dt>
				<dd><?php echo wp_kses_post($total['value']); ?></dd>
			</div>
		<?php endforeach; ?>
	</dl>

	<?php if ($order->get_customer_note()) : ?>
		<p class="rural-order-note"><strong>Your note:</strong> <?php echo wp_kses(nl2br(wc_wptexturize_order_note($order->get_customer_note())), ['br' => []]); ?></p>
	<?php endif; ?>
	<?php do_action('woocommerce_order_details_after_order_table', $order); ?>
</section>

<?php
do_action('woocommerce_after_order_details', $order);

if ($show_customer_details) {
	wc_get_template('order/order-details-customer.php', ['order' => $order]);
}
