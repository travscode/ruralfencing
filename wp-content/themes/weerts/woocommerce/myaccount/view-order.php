<?php
/**
 * Single order: status first, then what to do, then the details.
 *
 * @version 9.5.0
 */

defined('ABSPATH') || exit;

$notes = $order->get_customer_order_notes();
$actions = wc_get_account_orders_actions($order);
unset($actions['view']);
$explainer = weerts_order_status_explainer($order);
?>
<a class="rural-account__back" href="<?php echo esc_url(wc_get_account_endpoint_url('orders')); ?>">‹ All orders</a>

<header class="rural-account__page-head rural-account__page-head--order">
	<div>
		<h2 class="rural-account__title">Order #<?php echo esc_html($order->get_order_number()); ?></h2>
		<p class="rural-account__muted">Placed <?php echo esc_html(wc_format_datetime($order->get_date_created(), 'j M Y')); ?><?php if ($order->get_date_paid()) : ?> · Paid <?php echo esc_html(wc_format_datetime($order->get_date_paid(), 'j M Y')); ?><?php endif; ?></p>
	</div>
	<?php echo weerts_order_status_chip_html($order); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
</header>

<?php if ($explainer || $actions) : ?>
	<div class="rural-account__card rural-account__status-card rural-account__status-card--<?php echo esc_attr(weerts_order_status_chip($order)['tone']); ?>">
		<?php if ($explainer) : ?><p><?php echo esc_html($explainer); ?></p><?php endif; ?>
		<?php if ($actions) : ?>
			<div class="rural-order-card__actions">
				<?php foreach ($actions as $key => $action) : ?>
					<?php if ($key === 'pay') : ?>
						<?php echo weerts_account_button($action['name'], $action['url']); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					<?php else : ?>
						<a class="rural-account__btn rural-account__btn--ghost rural-account__btn--<?php echo esc_attr($key); ?>" href="<?php echo esc_url($action['url']); ?>"><?php echo esc_html($action['name']); ?></a>
					<?php endif; ?>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>
<?php endif; ?>

<?php if ($notes) : ?>
	<section class="rural-account__card" aria-labelledby="rural-order-updates">
		<h3 id="rural-order-updates">Updates from us</h3>
		<ol class="rural-order-updates">
			<?php foreach ($notes as $note) : ?>
				<li>
					<time datetime="<?php echo esc_attr(gmdate('c', strtotime($note->comment_date))); ?>"><?php echo esc_html(date_i18n('j M Y, g:ia', strtotime($note->comment_date))); ?></time>
					<div><?php echo wp_kses_post(wpautop(wptexturize($note->comment_content))); ?></div>
				</li>
			<?php endforeach; ?>
		</ol>
	</section>
<?php endif; ?>

<?php do_action('woocommerce_view_order', $order_id); ?>

<p class="rural-account__muted rural-account__order-help">Something not right with this order? Call <a href="tel:1800010319">1800 010 319</a> and quote order #<?php echo esc_html($order->get_order_number()); ?>.</p>
