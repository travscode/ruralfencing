<?php
/**
 * One line item: image, name, options, quantity, line total.
 *
 * @version 9.9.0
 */

defined('ABSPATH') || exit;

if (!apply_filters('woocommerce_order_item_visible', true, $item)) {
	return;
}

$is_visible = $product && $product->is_visible();
$product_permalink = apply_filters('woocommerce_order_item_permalink', $is_visible ? $product->get_permalink($item) : '', $item, $order);
$qty = $item->get_quantity();
$refunded_qty = $order->get_qty_refunded_for_item($item_id);
$qty_display = $refunded_qty ? '<del>' . esc_html($qty) . '</del> <ins>' . esc_html($qty - ($refunded_qty * -1)) . '</ins>' : esc_html($qty);
?>
<li class="<?php echo esc_attr(apply_filters('woocommerce_order_item_class', 'rural-order-item woocommerce-table__line-item order_item', $item, $order)); ?>">
	<span class="rural-order-item__thumb">
		<?php echo $product ? $product->get_image('woocommerce_thumbnail', ['loading' => 'lazy']) : wc_placeholder_img('woocommerce_thumbnail'); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	</span>
	<span class="rural-order-item__body">
		<span class="rural-order-item__name">
			<?php echo wp_kses_post(apply_filters('woocommerce_order_item_name', $product_permalink ? sprintf('<a href="%s">%s</a>', $product_permalink, $item->get_name()) : $item->get_name(), $item, $is_visible)); ?>
		</span>
		<?php
		do_action('woocommerce_order_item_meta_start', $item_id, $item, $order, false);
		wc_display_item_meta($item); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		do_action('woocommerce_order_item_meta_end', $item_id, $item, $order, false);
		?>
		<span class="rural-order-item__qty">Qty <?php echo $qty_display; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?><?php if ($product && $product->get_sku()) : ?> · <?php echo esc_html($product->get_sku()); ?><?php endif; ?></span>
		<?php if ($show_purchase_note && $purchase_note) : ?>
			<span class="rural-order-item__note"><?php echo wpautop(do_shortcode(wp_kses_post($purchase_note))); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
		<?php endif; ?>
	</span>
	<span class="rural-order-item__total"><?php echo $order->get_formatted_line_subtotal($item); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
</li>
