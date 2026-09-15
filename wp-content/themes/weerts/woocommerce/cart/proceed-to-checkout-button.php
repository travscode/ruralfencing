<?php
/**
 * Proceed to checkout: the theme's arrow button, full width in the totals card.
 *
 * @version 7.0.1
 */

defined('ABSPATH') || exit;
?>
<a href="<?php echo esc_url(wc_get_checkout_url()); ?>" class="rural-button rural-button--block checkout-button wc-forward">
	<span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 6h9.5M6.5 2l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg></span>
	<span>Proceed to checkout</span>
</a>
