<?php
/**
 * My Account shell: navigation beside the content on desktop, a pill strip above it on phones.
 *
 * @see https://woocommerce.com/document/template-structure/
 * @version 9.9.0
 */

defined('ABSPATH') || exit;
?>
<div class="rural-account">
	<?php do_action('woocommerce_account_navigation'); ?>

	<div class="rural-account__content woocommerce-MyAccount-content">
		<?php do_action('woocommerce_account_content'); ?>
	</div>
</div>
